// app/api/billing/checkout/route.js
export const runtime = 'nodejs'; // Stripe's SDK needs Node, not Edge

import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getUser } from '../../../lib/supabaseServerClient';

const stripe = (() => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    // Don't throw at import time during build; we validate inside POST too.
    return null;
  }
  return new Stripe(key, { apiVersion: '2024-06-20', typescript: false });
})();

function siteOriginFrom(req) {
  const h = req.headers;
  const proto = h.get('x-forwarded-proto') || 'https';
  const host = h.get('x-forwarded-host') || h.get('host');
  return `${proto}://${host}`;
}

function priceForPlan(plan) {
  const map = {
    bronze: process.env.STRIPE_PRICE_BRONZE,
    silver: process.env.STRIPE_PRICE_SILVER,
    gold: process.env.STRIPE_PRICE_GOLD,
    black: process.env.STRIPE_PRICE_BLACK,
  };
  return map[plan];
}

export async function POST(req) {
  try {
    if (!stripe) {
      return NextResponse.json(
        { error: 'missing_stripe_secret_key' },
        { status: 500 }
      );
    }

    // Auth
    const { user, profile } = await getUser(); // make sure this returns { user, profile? }
    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    // Body
    let body = {};
    try {
      body = await req.json();
    } catch {
      // allow empty JSON
    }
    const plan = (body.plan || '').toLowerCase();
    if (!['bronze', 'silver', 'gold', 'black'].includes(plan)) {
      return NextResponse.json({ error: 'invalid_plan' }, { status: 400 });
    }

    const priceId = priceForPlan(plan);
    if (!priceId) {
      return NextResponse.json(
        { error: `missing_price_env for plan ${plan}` },
        { status: 500 }
      );
    }

    // Success/cancel URLs
    const origin = siteOriginFrom(req);
    const success_url = body.success_url || `${origin}/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancel_url = body.cancel_url || `${origin}/plans?cancelled=1`;

    // Optional discounts
    const discounts = [];

    // Student .edu email -> 10% coupon
    const isEdu = (user.email || '').toLowerCase().endsWith('.edu');
    const studentCoupon = process.env.STRIPE_COUPON_STUDENT_10;
    if (isEdu && studentCoupon) discounts.push({ coupon: studentCoupon });

    // Referral credit -> 10% coupon if >= 2 credits
    // Assumes your profile has referral_credit_available (number)
    const referralCoupon = process.env.STRIPE_COUPON_REFERRAL_10;
    const credits = Number(profile?.referral_credit_available ?? 0);
    if (credits >= 2 && referralCoupon) discounts.push({ coupon: referralCoupon });

    // Create session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url,
      cancel_url,
      customer_email: user.email, // or set `customer` if you manage Stripe customer IDs
      metadata: {
        user_id: user.id,
        email: user.email || '',
        plan,
      },
      automatic_tax: { enabled: true },
      allow_promotion_codes: true, // lets you also apply codes manually
      ...(discounts.length ? { discounts } : {}),
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('checkout error:', err);
    // Surface a safe, helpful message to the client:
    let code = 'unknown_error';
    let hint = '';

    const msg = String(err?.message || '');

    if (msg.includes('No such price')) {
      code = 'bad_price_id';
      hint = 'Check STRIPE_PRICE_* env vars match existing Stripe Price IDs.';
    } else if (msg.includes('You cannot use') && msg.includes('mode')) {
      code = 'bad_price_mode';
      hint = 'Ensure the Price is a recurring price when using mode=subscription.';
    } else if (msg.includes('Invalid API Key')) {
      code = 'invalid_api_key';
      hint = 'Check STRIPE_SECRET_KEY in your environment.';
    }

    return NextResponse.json({ error: code, message: hint || msg }, { status: 500 });
  }
}
