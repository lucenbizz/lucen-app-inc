import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '../../../lib/supabaseAdmin.js';

export const runtime = 'nodejs';       // ensure Node runtime
export const dynamic = 'force-dynamic'; // don't cache webhook

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-06-20',
});

export async function POST(req) {
  const sig = req.headers.get('stripe-signature');
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !whSecret) {
    // If not configured yet, acknowledge to avoid retries during local dev
    return NextResponse.json({ ok: true, note: 'missing webhook secret or signature' }, { status: 200 });
  }

  let event;
  const rawBody = await req.text(); // IMPORTANT: raw body for signature verification

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, whSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;

      const plan = session.metadata?.plan;           // 'bronze' | 'silver' | 'gold' | 'black'
      const user_id = session.metadata?.user_id;     // from checkout creation
      const email = session.metadata?.email || session.customer_details?.email || null;
      const customerId = session.customer || null; 

      if (user_id && plan) {
        const supa = createSupabaseAdmin();

        // 1) Log purchase
        await supa.from('purchases').insert({
          user_id,
          plan_key: plan,
          stripe_session_id: session.id,
          amount_total: session.amount_total,
          currency: session.currency,
          email,
        });

        // 2) Grant entitlements (Platinum removed; Black = all ebooks + VIP)
        const grants = {
          bronze: { plan: 'bronze', ebooks_quota: 1,  priority_delivery: false, vip_badge: false },
          silver: { plan: 'silver', ebooks_quota: 2,  priority_delivery: false, vip_badge: false },
          gold:   { plan: 'gold',   ebooks_quota: 4,  priority_delivery: true, vip_badge: false },
          black:  { plan: 'black',  ebooks_quota: null, priority_delivery: true, vip_badge: true },
        }[plan] || null;

        if (grants) {
          await supa
            .from('profiles')
            .update({
              plan: grants.plan,
              ebooks_quota: grants.ebooks_quota,      // null = all ebooks
              priority_delivery: grants.priority_delivery,
              vip_badge: grants.vip_badge,
            })
            .eq('id', user_id);
        }
      }
    }

    // You can handle other events here if you like:
    // - 'checkout.session.async_payment_failed'
    // - 'payment_intent.payment_failed'
    // etc.

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    console.error('Webhook handler error:', err);
    return NextResponse.json({ error: 'handler_error' }, { status: 500 });
  }
}

