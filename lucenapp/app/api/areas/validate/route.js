// app/api/areas/validate/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/** Config — keep in sync with the UI */
const MIN_LEAD_MIN = 20;
const SUGGEST_COUNT = 6;

/** Helpers */
function json(data, status = 200) { return NextResponse.json(data, { status }); }
function err(msg, status = 400, extra = {}) { return json({ ok: false, error: msg, ...extra }, status); }
const isIso = (s) => !!s && !Number.isNaN(new Date(s).getTime());
const is20m = (iso) => { const d = new Date(iso); return d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0 && d.getUTCMinutes() % 20 === 0; };
const addMin = (d, m) => new Date(d.getTime() + m * 60 * 1000);
const ceilTo20 = (d0) => {
  const d = new Date(d0);
  d.setUTCSeconds(0, 0);
  const m = d.getUTCMinutes();
  d.setUTCMinutes(m + ((20 - (m % 20)) % 20));
  return d;
};
const suggest = (from, n = SUGGEST_COUNT) => {
  let c = ceilTo20(from);
  return Array.from({ length: n }, (_, i) => new Date(c.getTime() + i * 20 * 60 * 1000).toISOString());
};

function supabaseAnon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

/** Handler */
export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const area_tag = (body.area_tag ?? body.area ?? '').toString().trim();
    const delivery_slot_at = body.delivery_slot_at;

    if (!area_tag) return err('area_tag is required', 422, { field: 'area_tag' });
    if (!isIso(delivery_slot_at)) return err('delivery_slot_at must be an ISO datetime', 422, { field: 'delivery_slot_at' });

    // Alignment check first — with suggestions
    if (!is20m(delivery_slot_at)) {
      const minStart = addMin(new Date(), MIN_LEAD_MIN);
      return err('Slot must be on a 20-minute boundary (UTC)', 409, {
        code: 'SLOT_NOT_ALIGNED',
        nextSlots: suggest(minStart),
      });
    }

    // Lead-time check — with suggestions
    const now = new Date();
    const minStart = addMin(now, MIN_LEAD_MIN);
    if (new Date(delivery_slot_at) < minStart) {
      return err(`Slot too soon — requires ${MIN_LEAD_MIN} min lead time`, 409, {
        code: 'LEAD_TIME_TOO_SOON',
        nextSlots: suggest(minStart),
      });
    }

    // Confirm the area exists (strict)
    const sb = supabaseAnon();
    const { data, error } = await sb
      .from('areas')
      .select('tag')
      .eq('tag', area_tag)
      .maybeSingle();

    if (error) {
      // DB error — surface as server error (or soften to allow during dev)
      return err(error.message || 'Area lookup failed', 500, { code: 'AREA_LOOKUP_ERROR' });
    }
    if (!data?.tag) {
      return err('Area not recognized for delivery', 409, { code: 'AREA_UNKNOWN' });
    }

    // Passed
    return json({ ok: true, reason: 'area_exists_open_delivery' }, 200);
  } catch (e) {
    return err(e?.message || 'Unexpected error', 500);
  }
}
