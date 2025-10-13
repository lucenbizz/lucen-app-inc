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
function getAccessTokenFromCookies(store) {
  // 1) Direct helper cookie
  const direct = store.get('sb-access-token')?.value;
  if (direct) return direct;

  // 2) Browser cookie: sb-<ref>-auth-token is URL-encoded JSON: [access, refresh]
  const comboRaw = store.get(supabaseCookieName())?.value;
  if (comboRaw) {
    try {
      const decoded = decodeURIComponent(comboRaw);
      const arr = JSON.parse(decoded);
      if (Array.isArray(arr) && typeof arr[0] === 'string' && arr[0]) return arr[0];
    } catch {}
  }
  return null;
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
function jsonError(msg, status = 400, extra = {}) {
  return NextResponse.json({ ok: false, error: msg, ...extra }, { status });
}
function isIsoDate(s) {
  if (!s || typeof s !== 'string') return false;
  const d = new Date(s);
  return !Number.isNaN(d.getTime());
}
function is20MinBoundary(iso) {
  const d = new Date(iso);
  return d.getUTCMinutes() % 20 === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
}

/** ===== New permissive logic =====
 * Validation passes if:
 *   A) There exists an APPROVED delivery_request for (current user, area_tag, delivery_slot_at), OR
 *   B) The area **exists** in `areas` (we do NOT check active/coverage/staff anymore).
 * This effectively makes all currently included areas available for delivery.
 */
export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const area_tag = (body.area_tag || '').trim();
    const delivery_slot_at = body.delivery_slot_at;

    if (!area_tag) return jsonError('area_tag is required', 422, { field: 'area_tag' });
    if (!isIsoDate(delivery_slot_at))
      return jsonError('delivery_slot_at must be an ISO datetime', 422, { field: 'delivery_slot_at' });
    if (!is20MinBoundary(delivery_slot_at))
      return jsonError('Slot must be on a 20-minute boundary (e.g., 10:00, 10:20, 10:40 UTC)', 422, { field: 'delivery_slot_at' });

    const store = cookies(); // sync (no await)
    const token = getAccessTokenFromCookies(store);
    const supabase = supabaseWithBearer(token);

    // A) If caller is signed in and has an approved request, pass immediately
    let uid = null;
    if (token) {
      try {
        const { data: me } = await supabase.auth.getUser();
        uid = me?.user?.id || null;
      } catch {}
    }
    if (uid) {
      const { data: reqRow, error: reqErr } = await supabase
        .from('delivery_requests')
        .select('id, status')
        .eq('customer_id', uid)
        .eq('area_tag', area_tag)
        .eq('delivery_slot_at', new Date(delivery_slot_at).toISOString())
        .maybeSingle();

      if (!reqErr && reqRow?.status === 'approved') {
        return NextResponse.json({ ok: true, reason: 'approved_request' });
      }
    }

    // B) Permissive: if the area exists at all, allow it
    const { data: areaRow } = await supabase
      .from('areas')
      .select('tag')
      .eq('tag', area_tag)
      .maybeSingle();

    if (areaRow?.tag === area_tag) {
      return NextResponse.json({ ok: true, reason: 'area_exists_open_delivery' });
    }

    // If the areas table is empty/inaccessible, optionally allow everything:
    if (process.env.OPEN_DELIVERY_FALLBACK === 'true') {
      return NextResponse.json({ ok: true, reason: 'fallback_open_delivery' });
    }

    // Otherwise, area unknown → not available
    return jsonError('Area not recognized for delivery', 409, { code: 'AREA_UNKNOWN' });
  } catch (e) {
    const msg = (e && e.message) || 'Unexpected error';
    return jsonError(msg, 500);
  }
}
