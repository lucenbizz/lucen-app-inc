import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '../../../lib/supabaseAdmin.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-06-20',
});

export async function POST(req) {
  const sig = req.headers.get('stripe-signature');
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !whSecret) {
    return NextResponse.json({ ok: true, note: 'missing webhook secret or signature' }, { status: 200 });
  }

  let event;
  const rawBody = await req.text();

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, whSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;

      const plan = session.metadata?.plan;
      const buyer_id = session.metadata?.user_id;
      const email = session.metadata?.email || session.customer_details?.email || null;
      const customerId = session.customer || null;
      const used_referral_credit = session.metadata?.used_referral_credit === "1";
      const ref_code = session.metadata?.ref_code || ""; // referrer's user_id

      if (buyer_id && plan) {
        const supa = createSupabaseAdmin();

        // (1) Log purchase
        await supa.from('purchases').insert({
          user_id: buyer_id,
          plan_key: plan,
          stripe_session_id: session.id,
          amount_total: session.amount_total,
          currency: session.currency,
          email,
        });

        // (2) Grant plan entitlements
        const grants = {
          bronze: { plan: 'bronze', ebooks_quota: 1,  priority_delivery: false, vip_badge: false },
          silver: { plan: 'silver', ebooks_quota: 2,  priority_delivery: false, vip_badge: false },
          gold:   { plan: 'gold',   ebooks_quota: 4,  priority_delivery: false, vip_badge: false },
          black:  { plan: 'black',  ebooks_quota: null, priority_delivery: false, vip_badge: true },
        }[plan] || null;

        if (grants) {
          await supa
            .from('profiles')
            .update({
              plan: grants.plan,
              ebooks_quota: grants.ebooks_quota,
              priority_delivery: grants.priority_delivery,
              vip_badge: grants.vip_badge,
              stripe_customer_id: customerId,
              is_student: email?.toLowerCase().endsWith('.edu') ? true : undefined
            })
            .eq('id', buyer_id);
        }

        // (3) If a banked referral credit was used, decrement by 1
        if (used_referral_credit) {
          await supa.rpc('decrement_referral_credit', { target_user: buyer_id });
        }

        // (4) If someone referred this buyer, record & award credit every 2 referrals
        if (ref_code && ref_code !== buyer_id) {
          // unique referral entry (ignore dup error)
          const { error: refErr } = await supa.from('referrals').insert({
            referrer_id: ref_code,
            referred_id: buyer_id,
            stripe_session_id: session.id
          });
          if (refErr && !String(refErr.message || '').includes('duplicate')) {
            console.error('referral insert error', refErr);
          }

          // count unique referrals for the referrer
          const { count } = await supa
            .from('referrals')
            .select('*', { count: 'exact', head: true })
            .eq('referrer_id', ref_code);

          if ((count || 0) > 0 && (count % 2) === 0) {
            await supa.rpc('increment_referral_credit', { target_user: ref_code });
          }
        }
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    console.error('Webhook handler error:', err);
    return NextResponse.json({ error: 'handler_error' }, { status: 500 });
  }
}
