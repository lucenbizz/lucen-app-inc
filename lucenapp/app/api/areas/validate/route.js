// app/api/areas/validate/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const MIN_LEAD_MIN = 20;
const SUGGEST_COUNT = 6;

const isPreview = process.env.VERCEL_ENV === 'preview';

function json(d, s = 200) { return NextResponse.json(d, { status: s }); }
function err(msg, s = 400, extra = {}) { return json({ ok: false, error: msg, ...extra }, s); }
const isIso = (s) => !!s && !Number.isNaN(new Date(s).getTime());
const is20m = (iso) => { const d = new Date(iso); return d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0 && d.getUTCMinutes() % 20 === 0; };
const addMin = (d, m) => new Date(d.getTime() + m * 60 * 1000);
const ceilTo20 = (d0) => { const d = new Date(d0); d.setUTCSeconds(0, 0); const m = d.getUTCMinutes(); d.setUTCMinutes(m + ((20 - (m % 20)) % 20)); return d; };
const suggest = (from, n = SUGGEST_COUNT) => Array.from({ length: n }, (_, i) => new Date(ceilTo20(from).getTime() + i * 20 * 60 * 1000).toISOString());

// Use SERVICE ROLE so RLS can't hide rows from this server route
function supabaseService() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY, // server-only env
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const area_tag = (body.area_tag ?? body.area ?? '').toString().trim();
    const delivery_slot_at = body.delivery_slot_at;

    if (!area_tag) return err('area_tag is required', 422, { field: 'area_tag' });
    if (!isIso(delivery_slot_at)) return err('delivery_slot_at must be an ISO datetime', 422, { field: 'delivery_slot_at' });

    // Alignment → suggestions
    if (!is20m(delivery_slot_at)) {
      const minStart = addMin(new Date(), MIN_LEAD_MIN);
      return err('Slot must be on a 20-minute boundary (UTC)', 409, {
        code: 'SLOT_NOT_ALIGNED',
        nextSlots: suggest(minStart),
        ...(isPreview ? { debug: { received: { area_tag, delivery_slot_at } } } : {})
      });
    }

    // Lead time → suggestions
    const now = new Date();
    const minStart = addMin(now, MIN_LEAD_MIN);
    if (new Date(delivery_slot_at) < minStart) {
      return err(`Slot too soon — requires ${MIN_LEAD_MIN} min lead time`, 409, {
        code: 'LEAD_TIME_TOO_SOON',
        nextSlots: suggest(minStart),
        ...(isPreview ? { debug: { received: { area_tag, delivery_slot_at }, minStart: minStart.toISOString() } } : {})
      });
    }

    // Area must exist (tag column)
    let found = null, dbError = null;
    try {
      const sb = supabaseService();
      const { data, error } = await sb.from('areas').select('tag,active,name').eq('tag', area_tag).maybeSingle();
      if (error) dbError = error.message;
      found = data || null;
    } catch (e) {
      dbError = e?.message || 'lookup exception';
    }

    // In preview, don't block; pass with debug so you see the issue
    if (!found?.tag) {
      if (isPreview) {
        return json({
          ok: true,
          reason: 'preview_soft_open_area_missing',
          debug: { received: { area_tag, delivery_slot_at }, dbError }
        }, 200);
      }
      return err('Area not recognized for delivery', 409, {
        code: 'AREA_UNKNOWN',
        ...(dbError ? { dbError } : {}),
      });
    }

    // Passed
    return json({
      ok: true,
      reason: 'area_exists_open_delivery',
      ...(isPreview ? { debug: { received: { area_tag, delivery_slot_at }, matched: found } } : {})
    }, 200);
  } catch (e) {
    return err(e?.message || 'Unexpected error', 500);
  }
}
