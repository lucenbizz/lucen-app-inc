// app/api/billing/checkout/route.js
export const runtime = 'nodejs';             
export const dynamic = 'force-dynamic';      

import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getUser } from '../../../lib/supabaseServerClient.js'; // <- ensure .js

// Map plan -> ENV var name (so we can show which one is missing)
const PRICE_ENV = {
  bronze: 'STRIPE_PRICE_BRONZE',
  silver: 'STRIPE_PRICE_SILVER',
  gold:   'STRIPE_PRICE_GOLD',
  black:  'STRIPE_PRICE_BLACK',
};

function siteOriginFrom(req) {
  const h = req.headers;
  const proto = h.get('x-forwarded-proto') || 'https';
  const host  = h.get('x-forwarded-host') || h.get('host');
  return `${proto}://${host}`;
}

function json(status, body) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

export async function POST(req) {
  try {
    // --- Auth (server-side cookie session) ---
    const { user, profile } = await getUser();
    if (!user) return json(401, { error: 'unauthorized' });

    // --- Inputs ---
    let body = {};
    try { body = await req.json(); } catch { /* allow empty */ }

    const plan = String(body.plan || '').toLowerCase();
    if (!PRICE_ENV[plan]) {
      return json(400, { error: 'invalid_plan', allowed: Object.keys(PRICE_ENV) });
    }

    const priceEnv = PRICE_ENV[plan];
    const priceId  = process.env[priceEnv];
    if (!priceId) {
      return json(500, { error: 'missing_price_env', missing: priceEnv });
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) return json(500, { error: 'missing_stripe_secret_key' });

    const stripe = new Stripe(secretKey, { apiVersion: '2024-06-20' });

    // --- URLs ---
    const site = process.env.NEXT_PUBLIC_SITE_URL || siteOriginFrom(req);
    const success_url = body.success_url || `${site}/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancel_url  = body.cancel_url  || `${site}/plans?cancelled=1`;

    // --- Optional discounts ---
    const discounts = [];
    const isEdu = (user.email || '').toLowerCase().endsWith('.edu');
    if (isEdu && process.env.STRIPE_COUPON_STUDENT_10) {
      discounts.push({ coupon: process.env.STRIPE_COUPON_STUDENT_10 });
    }
    const credits = Number(profile?.referral_credit_available ?? 0);
    if (credits >= 2 && process.env.STRIPE_COUPON_REFERRAL_10) {
      discounts.push({ coupon: process.env.STRIPE_COUPON_REFERRAL_10 });
    }

    // --- Create Checkout Session ---
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',                     // change to 'payment' if one-time
      line_items: [{ price: priceId, quantity: 1 }],
      success_url,
      cancel_url,
      customer_email: user.email,               // or use `customer` if you store IDs
      client_reference_id: user.id,
      metadata: { user_id: user.id, email: user.email || '', plan },
      automatic_tax: { enabled: true },
      allow_promotion_codes: true,
      ...(discounts.length ? { discounts } : {}),
    });

    return json(200, { url: session.url });
  } catch (err) {
    const msg = String(err?.message || '');
    let code = 'server_error';
    let hint = '';

    if (msg.includes('No such price')) {
      code = 'bad_price_id';
      hint = 'Verify STRIPE_PRICE_* env vars match real Stripe Price IDs.';
    } else if (msg.includes('mode') && msg.includes('use')) {
      code = 'bad_price_mode';
      hint = 'Use a recurring Price for mode=subscription (or switch to mode=payment).';
    } else if (msg.includes('Invalid API Key')) {
      code = 'invalid_api_key';
      hint = 'Check STRIPE_SECRET_KEY in your Vercel env.';
    }

    console.error('checkout_error:', err);
    return json(500, { error: code, message: hint || msg });
  }
}
