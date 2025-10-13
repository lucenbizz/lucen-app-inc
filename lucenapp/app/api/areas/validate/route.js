// app/api/areas/validate/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

/** ===== Config ===== */
const MIN_LEAD_MIN = Number(process.env.MIN_LEAD_MIN || '20'); // default 20 minutes
const SUGGEST_COUNT = 6;

/** ===== Helpers ===== */
function supabaseCookieName() {
  const ref =
    (process.env.NEXT_PUBLIC_SUPABASE_URL || '').match(
      /^https?:\/\/([a-z0-9-]+)\.supabase\.co/i
    )?.[1] || 'khzbliduummbypuxqnfn';
  return `sb-${ref}-auth-token`;
}
function getAccessTokenFromCookies(store) {
  const direct = store.get('sb-access-token')?.value;
  if (direct) return direct;
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
function json(data, status = 200) {
  return NextResponse.json(data, { status });
}
function jsonError(msg, status = 400, extra = {}) {
  return json({ ok: false, error: msg, ...extra }, status);
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
function ceilToNext20MinUTC(fromDate) {
  const d = new Date(fromDate);
  d.setUTCSeconds(0, 0);
  const m = d.getUTCMinutes();
  const add = (20 - (m % 20)) % 20;
  d.setUTCMinutes(m + add);
  return d;
}
function addMinutes(date, min) {
  return new Date(date.getTime() + min * 20 * 1000);
}
function nextSlotsAfterLead(fromDate, count = SUGGEST_COUNT) {
  const out = [];
  let cursor = ceilToNext20MinUTC(fromDate);
  for (let i = 0; i < count; i++) {
    out.push(cursor.toISOString());
    cursor = addMinutes(cursor, 20);
  }
  return out;
}

/** ===== Logic =====
 * Pass if:
 *  A) Caller has an approved delivery_request for (uid, area_tag, slot), OR
 *  B) The area exists in `areas` table (open policy), the slot is on a 20-min boundary,
 *     and slot time >= now + MIN_LEAD_MIN.
 * On failure, return suggestions via `nextSlots`.
 */
export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const area_tag = (body.area_tag || '').trim();
    const delivery_slot_at = body.delivery_slot_at;

    if (!area_tag) return jsonError('area_tag is required', 422, { field: 'area_tag' });
    if (!isIsoDate(delivery_slot_at))
      return jsonError('delivery_slot_at must be an ISO datetime', 422, { field: 'delivery_slot_at' });

    // Check 20-min boundary early and suggest aligned slots if needed
    if (!is20MinBoundary(delivery_slot_at)) {
      const now = new Date();
      const minStart = addMinutes(now, MIN_LEAD_MIN);
      return jsonError('Slot must be on a 20-minute boundary', 409, {
        code: 'SLOT_NOT_ALIGNED',
        nextSlots: nextSlotsAfterLead(minStart),
      });
    }

    const store = cookies();
    const token = getAccessTokenFromCookies(store);
    const supabase = supabaseWithBearer(token);

    // Optional: approve via delivery_requests if signed in
    if (token) {
      try {
        const { data: me } = await supabase.auth.getUser();
        const uid = me?.user?.id || null;
        if (uid) {
          const { data: reqRow } = await supabase
            .from('delivery_requests')
            .select('id,status')
            .eq('customer_id', uid)
            .eq('area_tag', area_tag)
            .eq('delivery_slot_at', new Date(delivery_slot_at).toISOString())
            .maybeSingle();
          if (reqRow?.status === 'approved') {
            return json({ ok: true, reason: 'approved_request' });
          }
        }
      } catch {}
    }

    // Area must exist (open delivery across existing areas)
    const { data: areaRow } = await supabase
      .from('areas')
      .select('tag')
      .eq('tag', area_tag)
      .maybeSingle();

    if (!areaRow?.tag) {
      return jsonError('Area not recognized for delivery', 409, { code: 'AREA_UNKNOWN' });
    }

    // Lead-time check
    const now = new Date();
    const minStart = addMinutes(now, MIN_LEAD_MIN);
    const slot = new Date(delivery_slot_at);
    if (slot < minStart) {
      return jsonError(`Slot too soon — requires ${MIN_LEAD_MIN} min lead time`, 409, {
        code: 'LEAD_TIME_TOO_SOON',
        nextSlots: nextSlotsAfterLead(minStart),
      });
    }

    // Passed all checks
    return json({ ok: true, reason: 'area_exists_open_delivery' });
  } catch (e) {
    return jsonError(e?.message || 'Unexpected error', 500);
  }
}
