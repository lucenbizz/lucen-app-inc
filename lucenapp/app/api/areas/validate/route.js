// app/api/areas/validate/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

/** ===== Helpers ===== */
function supabaseCookieName() {
  const ref =
    (process.env.NEXT_PUBLIC_SUPABASE_URL || '').match(
      /^https?:\/\/([a-z0-9-]+)\.supabase\.co/i
    )?.[1] || 'khzbliduummbypuxqnfn';
  return `sb-${ref}-auth-token`;
}
function supabaseWithBearer(token) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
}
function jsonError(msg, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}
function isIsoDate(s) {
  if (!s || typeof s !== 'string') return false;
  const d = new Date(s);
  return !Number.isNaN(d.getTime());
}
function enforce20MinIncrement(iso) {
  const d = new Date(iso);
  return d.getUTCMinutes() % 20 === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
}

/** ===== Core checks =====
 * Validation passes if:
 *   A) There exists an APPROVED delivery_request for (current user, area_tag, delivery_slot_at), OR
 *   B) We can infer radius availability for that area/slot (best-effort):
 *      - area exists and is active; and
 *      - there appears to be at least 1 staff/exec covering this area (via user_areas, or profiles default area, or area capacity fields)
 */
export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const area_tag = (body.area_tag || '').trim();
    const delivery_slot_at = body.delivery_slot_at;

    if (!area_tag) return jsonError('area_tag is required');
    if (!isIsoDate(delivery_slot_at)) return jsonError('delivery_slot_at must be an ISO datetime');
    if (!enforce20MinIncrement(delivery_slot_at))
      return jsonError('Slot must be on a 20-minute boundary (e.g., 10:00, 10:20, 10:40)');

    const store = await cookies();
    const token = store.get(supabaseCookieName())?.value || '';
    const supabase = supabaseWithBearer(token);

    // who is calling (used for approved request match)
    const { data: me, error: meErr } = await supabase.auth.getUser();
    if (meErr || !me?.user?.id) return jsonError('Not signed in', 401);
    const uid = me.user.id;

    // A) Approved request exists?
    const { data: reqRow, error: reqErr } = await supabase
      .from('delivery_requests')
      .select('id, status')
      .eq('customer_id', uid)
      .eq('area_tag', area_tag)
      .eq('delivery_slot_at', new Date(delivery_slot_at).toISOString())
      .single();

    if (!reqErr && reqRow && reqRow.status === 'approved') {
      return NextResponse.json({ ok: true, reason: 'approved_request' });
    }

    // B) Radius/coverage availability (best effort across likely schemas)
    // 1) Area exists & active?
    //    We attempt to select several possible columns; supabase will return those that exist.
    const { data: area, error: areaErr } = await supabase
      .from('areas')
      .select('tag, active, driver_count, drivers_online, min_staff, capacity')
      .eq('tag', area_tag)
      .maybeSingle?.() || { data: null, error: null }; // .maybeSingle() may not exist in your version

    // If your client doesn't have maybeSingle, fallback:
    // const { data: areasList, error: areaErr } = await supabase.from('areas').select('...').eq('tag', area_tag).limit(1);
    // const area = areasList && areasList[0];

    if (areaErr) {
      // If areas table is missing or not accessible, fall through: treat as not available
    }

    let areaActive = false;
    if (area && typeof area === 'object') {
      if ('active' in area) areaActive = !!area.active;
      else areaActive = true; // assume active if column not present
    }

    // 2) Is there at least one staff/exec covering this area?
    // Try user_areas(area_tag, active) first
    let coveringCount = 0;
    try {
      const ua = await supabase
        .from('user_areas')
        .select('user_id')
        .eq('area_tag', area_tag)
        .eq('active', true)
        .limit(1);
      if (!ua.error && Array.isArray(ua.data) && ua.data.length > 0) {
        coveringCount = 1;
      }
    } catch {}

    // If none found, fallback: profiles with default_area_tag = area_tag (if that column exists), else profiles with role flags
    if (coveringCount === 0) {
      try {
        const pf = await supabase
          .from('profiles')
          .select('user_id, is_staff, is_executive, default_area_tag')
          .or('is_staff.eq.true,is_executive.eq.true')
          .eq('default_area_tag', area_tag)
          .limit(1);
        if (!pf.error && Array.isArray(pf.data) && pf.data.length > 0) {
          coveringCount = 1;
        }
      } catch {}
    }

    // Last fallback: area capacity style fields (driver_count / min_staff / drivers_online / capacity)
    if (coveringCount === 0 && area && typeof area === 'object') {
      const candidates = [
        Number(area.driver_count),
        Number(area.drivers_online),
        Number(area.min_staff),
        Number(area.capacity),
      ].filter((n) => Number.isFinite(n));
      if (candidates.some((n) => n > 0)) coveringCount = 1;
    }

    if (areaActive && coveringCount > 0) {
      return NextResponse.json({ ok: true, reason: 'radius_ok' });
    }

    return jsonError('No approved request or available coverage for this slot/area', 409);
  } catch (e) {
    const msg = (e && e.message) || 'Unexpected error';
    return jsonError(msg, 500);
  }
}
