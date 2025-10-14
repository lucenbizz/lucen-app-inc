// app/api/payments/checkout/session/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripeKey = process.env.STRIPE_RESTRICTED_KEY || process.env.STRIPE_SECRET_KEY;
if (!stripeKey) throw new Error('Missing STRIPE_RESTRICTED_KEY (or STRIPE_SECRET_KEY fallback)');
const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });

function err(msg, status=400, extra={}) { return NextResponse.json({ ok:false, error:msg, ...extra }, { status }); }

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return err('Missing session id', 422);

    // Expand line_items if you want to show product names
    const sess = await stripe.checkout.sessions.retrieve(id, { expand: ['line_items'] });

    // Return only safe fields
    return NextResponse.json({
      ok: true,
      id: sess.id,
      status: sess.status,
      payment_status: sess.payment_status,
      amount_total: sess.amount_total,
      currency: sess.currency,
      customer_details: {
        email: sess.customer_details?.email || null,
        name: sess.customer_details?.name || null,
      },
      line_items: sess.line_items?.data?.map(li => ({
        description: li.description,
        quantity: li.quantity,
        amount_subtotal: li.amount_subtotal,
        amount_total: li.amount_total,
      })) || [],
    });
  } catch (e) {
    return err(e?.message || 'Failed to retrieve session', e?.statusCode ?? 500, {
      code: e?.code || null, type: e?.type || null
    });
  }
}
