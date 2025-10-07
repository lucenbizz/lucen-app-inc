// app/api/coverage/check/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

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

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const area_tag = (body.area_tag || '').trim();
    const delivery_slot_at = body.delivery_slot_at;

    if (!area_tag) return jsonError('area_tag is required');
    if (!isIsoDate(delivery_slot_at)) return jsonError('delivery_slot_at must be an ISO datetime');
    if (!enforce20MinIncrement(delivery_slot_at))
      return jsonError('Slot must be on a 20-minute boundary (e.g., 10:00, 10:20, 10:40)');

    // Delegate to the canonical validator
    const origin = process.env.NEXT_PUBLIC_APP_ORIGIN || req.nextUrl.origin;
    const r = await fetch(`${origin}/api/areas/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ area_tag, delivery_slot_at }),
    });

    const payload = await r.json().catch(() => ({}));
    if (!r.ok || !payload?.ok) {
      return jsonError(payload?.error || 'Coverage not available', r.status || 409);
    }
    return NextResponse.json(payload); // { ok: true, reason: 'approved_request' | 'radius_ok' }
  } catch (e) {
    return jsonError((e && e.message) || 'Unexpected error', 500);
  }
}

