// app/api/payments/intent/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import Stripe from 'stripe';
import crypto from 'node:crypto';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

function jsonError(msg, status = 400, extra = {}) {
  return NextResponse.json({ ok: false, error: msg, ...extra }, { status });
}
function isIsoDate(s) { if (!s || typeof s !== 'string') return false; const d = new Date(s); return !Number.isNaN(d.getTime()); }
function is20MinBoundary(iso) { const d = new Date(iso); return d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0 && d.getUTCMinutes() % 20 === 0; }
function cents(n) { const x = Number(n); return Number.isFinite(x) ? Math.max(0, Math.round(x)) : 0; }
function stableKeyFromOrder(orderTempId) {
  const base = orderTempId || 'noorder';
  return 'intent_' + crypto.createHash('sha256').update(base).digest('hex').slice(0, 16);
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));

    const area_tag = (body.area_tag ?? body.areaTag ?? body.area ?? '').toString().trim();
    const delivery_slot_at = (body.delivery_slot_at ?? body.deliverySlotAt ?? body.slotAt ?? body.slot ?? '').toString().trim();
    const cartTotalCents = cents(body.cartTotalCents ?? body.totalCents ?? body.amount ?? 0);
    const reservationId = typeof body.reservationId === 'string' && body.reservationId.trim() ? body.reservationId.trim() : null;
    const orderTempId = typeof body.orderTempId === 'string' && body.orderTempId.trim() ? body.orderTempId.trim() : null;
    const purchaseTier = (body.tier || body.purchaseTier || '').toString();

    if (!area_tag) return jsonError('area_tag is required', 422, { field: 'area_tag' });
    if (!isIsoDate(delivery_slot_at)) return jsonError('delivery_slot_at must be an ISO datetime', 422, { field: 'delivery_slot_at' });
    if (!is20MinBoundary(delivery_slot_at)) return jsonError('Slot must be on a 20-minute boundary (e.g., 10:00, 10:20, 10:40 UTC)', 422, { field: 'delivery_slot_at' });
    if (!cartTotalCents) return jsonError('cartTotalCents is required', 422, { field: 'cartTotalCents' });

    // Supabase session
    const store = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => store });
    const { data: { user }, error: meErr } = await supabase.auth.getUser();
    if (meErr || !user?.id) return jsonError('Not signed in', 401, { code: 'AUTH_REQUIRED' });
    const uid = user.id;

    // Validate coverage
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
        debug: vj?.debug, // ← SEE EXACT CAUSE IN NETWORK RESPONSE (esp. on preview)
      });
    }

    // Optional loyalty reservation
    let discountCents = 0;
    if (reservationId) {
      const { data: rsv, error: rErr } = await supabase
        .from('loyalty_reservations')
        .select('id, user_id, value_cents, expires_at, committed_at, order_temp_id')
        .eq('id', reservationId)
        .maybeSingle();

      if (rErr) return jsonError(rErr.message || 'Failed to check reservation', 500, { code: 'RSV_LOOKUP_FAILED' });
      if (!rsv || rsv.user_id !== uid) return jsonError('Reservation does not belong to you', 403, { code: 'RSV_FORBIDDEN' });

      const expMs = rsv.expires_at ? new Date(rsv.expires_at).getTime() : 0;
      if (!expMs || expMs <= Date.now()) return jsonError('Reservation expired', 409, { code: 'RSV_EXPIRED' });
      if (rsv.committed_at) return jsonError('Reservation already used', 409, { code: 'RSV_USED' });
      if (orderTempId && rsv.order_temp_id && rsv.order_temp_id !== orderTempId) {
        return jsonError('Reservation order mismatch', 409, { code: 'RSV_ORDER_MISMATCH' });
      }

      discountCents = cents(rsv.value_cents);
    }

    const amountCents = Math.max(0, cartTotalCents - discountCents);

    // Reuse/update PI when possible
    const cookieName = orderTempId ? `pi_${orderTempId}` : 'payment_intent_id';
    const existingPiId = store.get(cookieName)?.value || null;
    let intent = null;

    try {
      if (existingPiId) {
        const current = await stripe.paymentIntents.retrieve(existingPiId);
        if (current.status === 'requires_payment_method' || current.status === 'requires_confirmation') {
          intent = await stripe.paymentIntents.update(existingPiId, {
            amount: amountCents,
            currency: 'usd',
            metadata: {
              ...current.metadata,
              user_id: uid,
              area_tag,
              delivery_slot_at,
              order_temp_id: orderTempId || '',
              reservation_id: reservationId || '',
              purchase_tier: purchaseTier,
              discount_cents: String(discountCents || 0),
            },
          });
        }
      }
    } catch {
      // ignore; we'll create new
    }

    if (!intent) {
      const idem = stableKeyFromOrder(orderTempId || '');
      intent = await stripe.paymentIntents.create(
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
            discount_cents: String(discountCents || 0),
          },
        },
        { idempotencyKey: idem }
      );
    }

    const res = NextResponse.json({
      ok: true,
      provider: 'stripe',
      amountCents,
      discountCents,
      paymentIntentId: intent.id,
      clientSecret: intent.client_secret,
      area_tag,
      delivery_slot_at,
      orderTempId: orderTempId || null,
      validation: vj?.reason || 'validated',
      debug: vj?.debug // helpful in preview
    });

    // Persist PI id (httpOnly cookie)
    res.cookies.set(cookieName, intent.id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return res;
  } catch (e) {
    const store = cookies();
    const piFallback =
      store.get('payment_intent_id')?.value ||
      (store.getAll().find(c => c.name.startsWith('pi_'))?.value ?? null);

    if (e?.statusCode === 409 && piFallback) {
      try {
        const existing = await stripe.paymentIntents.retrieve(piFallback);
        return NextResponse.json({
          ok: true,
          recovered: true,
          paymentIntentId: existing.id,
          clientSecret: existing.client_secret,
          status: existing.status,
        });
      } catch {}
    }

    return jsonError(e?.message || 'Unexpected error', e?.statusCode ?? 500, {
      code: e?.code ?? 'UNEXPECTED',
      type: e?.type ?? null,
      statusCode: e?.statusCode ?? 500,
    });
  }
}
