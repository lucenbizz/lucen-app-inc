// app/api/payments/checkout/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import Stripe from 'stripe';

const stripeKey = process.env.STRIPE_RESTRICTED_KEY;
if (!stripeKey) throw new Error('Missing STRIPE_RESTRICTED_KEY');

const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });

/* helpers */
function jsonError(msg, status = 400, extra = {}) {
  return NextResponse.json({ ok: false, error: msg, ...extra }, { status });
}
function cents(n) {
  const x = Number(n);
  return Number.isFinite(x) ? Math.max(0, Math.round(x)) : 0;
}
const isIso = s => !!s && !Number.isNaN(new Date(s).getTime());
const is20m = iso => { const d = new Date(iso); return d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0 && d.getUTCMinutes() % 20 === 0; };

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      amountCents: amountRaw,
      currency = 'usd',
      tier = '',
      area_tag = '',
      delivery_slot_at = '',
      orderTempId = null,
      reservationId = null,
    } = body || {};

    const amountCents = cents(amountRaw);
    if (!amountCents) return jsonError('amountCents required', 422);

    // Require Supabase user (prod)
    const store = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => store });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return jsonError('Not signed in', 401, { code: 'AUTH_REQUIRED' });

    // Validate area/slot (same gate as before)
    if (!area_tag) return jsonError('area_tag required', 422);
    if (!isIso(delivery_slot_at)) return jsonError('delivery_slot_at must be ISO', 422);
    if (!is20m(delivery_slot_at)) return jsonError('Slot must be 20-min boundary UTC', 422);

    const origin = new URL(req.url).origin;
    const v = await fetch(`${origin}/api/areas/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ area_tag, delivery_slot_at }),
    });
    const vj = await v.json().catch(() => ({}));
    if (!v.ok || !vj?.ok) {
      return jsonError(vj?.error || 'Delivery not available for this area/slot', 409, {
        code: vj?.code || 'DELIVERY_UNAVAILABLE',
        reason: vj?.reason,
        nextSlots: vj?.nextSlots,
      });
    }

    // Build a Stripe Checkout Session (one-time payment)
    const success_url = `${origin}/checkout/thank-you?session_id={CHECKOUT_SESSION_ID}`;
    const cancel_url = `${origin}/checkout?canceled=1`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url,
      cancel_url,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: amountCents,
            product_data: {
              name: tier ? `Order — ${tier}` : 'Order',
              // description is optional
            },
          },
        },
      ],
      client_reference_id: orderTempId || undefined,
      metadata: {
        user_id: user.id,
        area_tag,
        delivery_slot_at,
        purchase_tier: tier,
        order_temp_id: orderTempId || '',
        reservation_id: reservationId || '',
      },
      allow_promotion_codes: true,
      automatic_tax: { enabled: false },
    });

    // You can redirect on the client with session.url
    return NextResponse.json({ ok: true, sessionId: session.id, url: session.url });
  } catch (e) {
    return jsonError(e?.message || 'Failed to create checkout session', e?.statusCode ?? 500, {
      code: e?.code || null,
      type: e?.type || null,
      statusCode: e?.statusCode ?? 500,
    });
  }
}
