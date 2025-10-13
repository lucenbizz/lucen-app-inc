// app/api/stripe/webhook/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET; // from your Stripe Dashboard

export async function POST(req) {
  let event;
  try {
    const sig = req.headers.get('stripe-signature');
    const rawBody = await req.text(); // IMPORTANT: raw text body
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (e) {
    return NextResponse.json({ ok: false, error: `Webhook signature verification failed: ${e.message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const pi = event.data.object;
        // TODO: mark order paid, grant access, send receipt, etc.
        break;
      }
      case 'payment_intent.payment_failed': {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const pi = event.data.object;
        // TODO: notify user or log failure
        break;
      }
      // add more events if needed
    }
  } catch (e) {
    // Avoid retry loops by returning 2xx unless you truly want Stripe to retry
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
