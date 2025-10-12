// app/api/payments/intent/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
});

/* ========= helpers ========= */
function jsonError(msg, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}
function isIsoDate(s) {
  if (!s || typeof s !== 'string') return false;
  const d = new Date(s);
  return !Number.isNaN(d.getTime());
}
function is20MinBoundary(iso) {
  const d = new Date(iso);
  return d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0 && d.getUTCMinutes() % 20 === 0;
}
function cents(n) {
  const x = Number(n);
  return Number.isFinite(x) ? Math.max(0, Math.round(x)) : 0;
}

/* ========= handler ========= */
export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));

    // Accept aliases from different UIs
    const area_tag = (body.area_tag ?? body.areaTag ?? body.area ?? '').toString().trim();
    const delivery_slot_at = (
      body.delivery_slot_at ??
      body.deliverySlotAt ??
      body.slotAt ??
      body.slot ??
      ''
    ).toString().trim();

    const cartTotalCents = cents(body.cartTotalCents ?? body.totalCents ?? body.amount ?? 0);
    const reservationId =
      typeof body.reservationId === 'string' && body.reservationId.trim()
        ? body.reservationId.trim()
        : null;
    const orderTempId =
      typeof body.orderTempId === 'string' && body.orderTempId.trim()
        ? body.orderTempId.trim()
        : null;
    const purchaseTier = (body.tier || '').toString();

    if (!area_tag) return jsonError('area_tag is required');
    if (!isIsoDate(delivery_slot_at)) return jsonError('delivery_slot_at must be an ISO datetime');
    if (!is20MinBoundary(delivery_slot_at))
      return jsonError('Slot must be on a 20-minute boundary (e.g., 10:00, 10:20, 10:40 UTC)');
    if (!cartTotalCents) return jsonError('cartTotalCents is required');

    // ✅ Supabase auth by cookies (RLS-safe)
    const store = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => store });
    const { data: { user }, error: meErr } = await supabase.auth.getUser();
    if (meErr || !user?.id) return jsonError('Not signed in', 401);
    const uid = user.id;

    // HARD GATE: centralized coverage validator
    const origin = process.env.NEXT_PUBLIC_APP_ORIGIN || req.nextUrl.origin;
    const v = await fetch(`${origin}/api/areas/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ area_tag, delivery_slot_at }),
    });
    const vj = await v.json().catch(() => ({}));
    if (!v.ok || !vj?.ok) {
      return jsonError(vj?.error || 'Delivery not available for this area/slot', 409);
    }

    // Optional: verify loyalty reservation
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

    // ---- Stripe PaymentIntent ----
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: amountCents,
        currency: 'usd',
        automatic_payment_methods: { enabled: true },
        metadata: {
          user_id: uid,
          area_tag,
          delivery_slot_at,
          order_temp_id: orderTempId || '',
          reservation_id: reservationId || '',
          purchase_tier: purchaseTier,
        },
      },
      {
        idempotencyKey: `intent_${orderTempId || 'noorder'}_${amountCents}`,
      }
    );

    return NextResponse.json({
      ok: true,
      provider: 'stripe',
      amountCents,
      discountCents,
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      area_tag,
      delivery_slot_at,
      orderTempId: orderTempId || null,
      validation: vj?.reason || 'validated',
    });
  } catch (e) {
    return jsonError((e && e.message) || 'Unexpected error', 500);
  }
}
