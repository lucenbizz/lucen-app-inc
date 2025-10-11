// app/api/payments/intent/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

/* ================= Helpers ================= */
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
// must be exactly on 20-min boundaries, UTC, with :00 seconds
function is20MinBoundary(iso) {
  const d = new Date(iso);
  return d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0 && d.getUTCMinutes() % 20 === 0;
}
function cents(n) {
  const x = Number(n);
  return Number.isFinite(x) ? Math.max(0, Math.round(x)) : 0;
}
function randomId() {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const a = new Uint32Array(4);
    crypto.getRandomValues(a);
    return [...a].map((x) => x.toString(16).padStart(8, '0')).join('');
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/* ================= Handler ================= */
export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));

    // Accept both snake_case and camelCase
    const area_tag = (body.area_tag ?? body.areaTag ?? '').toString().trim();
    const delivery_slot_at = (body.delivery_slot_at ?? body.deliverySlotAt ?? '').toString().trim();

    const cartTotalCents = cents(body.cartTotalCents ?? body.totalCents ?? 0);
    const reservationId =
      typeof body.reservationId === 'string' && body.reservationId.trim()
        ? body.reservationId.trim()
        : null;
    const orderTempId =
      typeof body.orderTempId === 'string' && body.orderTempId.trim()
        ? body.orderTempId.trim()
        : null;

    // Basic validation
    if (!area_tag) return jsonError('area_tag is required');
    if (!isIsoDate(delivery_slot_at)) return jsonError('delivery_slot_at must be an ISO datetime');
    if (!is20MinBoundary(delivery_slot_at))
      return jsonError('Slot must be on a 20-minute boundary (e.g., 10:00, 10:20, 10:40 UTC)');
    if (!cartTotalCents) return jsonError('cartTotalCents is required');

    // Identify user (needed for reservation verification & RLS)
    const store = await cookies();
    const token = store.get(supabaseCookieName())?.value || '';
    const supabase = supabaseWithBearer(token);

    const { data: me, error: meErr } = await supabase.auth.getUser();
    if (meErr || !me?.user?.id) return jsonError('Not signed in', 401);
    const uid = me.user.id;

    // 1) HARD GATE: This area/slot must be validated/approved
    const origin = process.env.NEXT_PUBLIC_APP_ORIGIN || req.nextUrl.origin;
    const valRes = await fetch(`${origin}/api/areas/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ area_tag, delivery_slot_at }),
    });
    const valJson = await valRes.json().catch(() => ({}));
    if (!valRes.ok || !valJson?.ok) {
      return jsonError(valJson?.error || 'Delivery not available for this area/slot', 409);
    }

    // 2) Optional loyalty reservation: verify and compute discount
    let discountCents = 0;
    if (reservationId) {
      const { data: rsv, error: rErr } = await supabase
        .from('loyalty_reservations')
        .select('id, user_id, value_cents, expires_at, committed_at, order_temp_id')
        .eq('id', reservationId)
        .single();

      if (rErr) return jsonError(rErr.message || 'Failed to check reservation', 500);
      if (!rsv || rsv.user_id !== uid) return jsonError('Reservation does not belong to you', 403);

      const expMs = rsv.expires_at ? new Date(rsv.expires_at).getTime() : 0;
      if (!expMs || expMs <= Date.now()) return jsonError('Reservation expired', 409);
      if (rsv.committed_at) return jsonError('Reservation already used', 409);
      if (orderTempId && rsv.order_temp_id && rsv.order_temp_id !== orderTempId) {
        return jsonError('Reservation order mismatch', 409);
      }

      discountCents = cents(rsv.value_cents);
    }

    const amountCents = Math.max(0, cartTotalCents - discountCents);

    // 3) Create a DEMO payment intent (replace with Stripe/your PSP as needed)
    const paymentIntentId = `pi_${randomId()}`;
    const clientSecret = `demo_${paymentIntentId}_${randomId()}`;

    // (Optional) Persist a "pending intent" row for auditing
    // await supabase.from('payment_intents').insert({ ... })

    return NextResponse.json({
      ok: true,
      provider: 'demo',
      amountCents,
      discountCents,
      paymentIntentId,
      clientSecret,
      area_tag,
      delivery_slot_at,
      orderTempId: orderTempId || null,
      validation: valJson?.reason || 'validated',
    });
  } catch (e) {
    return jsonError((e && e.message) || 'Unexpected error', 500);
  }
}
