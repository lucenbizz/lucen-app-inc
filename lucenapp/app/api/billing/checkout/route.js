 
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { headers } from "next/headers";


import { getUserAndProfile } from "../../../lib/supabaseServerClient.js";
// import { getUserAndProfile } from "../../../../lib/supabaseServerClient.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripeSecret = process.env.STRIPE_SECRET_KEY || "";
const stripe = new Stripe(stripeSecret, { apiVersion: "2024-06-20" });

// Map to your ONE-TIME Price IDs
const PLAN_TO_PRICE = {
  bronze: process.env.PRICE_BRONZE,
  silver: process.env.PRICE_SILVER,
  gold:   process.env.PRICE_GOLD,
  black:  process.env.PRICE_BLACK,
};

function originFrom(reqHeaders) {
  const proto = reqHeaders.get("x-forwarded-proto") || "http";
  const host  = reqHeaders.get("x-forwarded-host") || reqHeaders.get("host") || "localhost:3000";
  return `${proto}://${host}`;
}

export async function POST(req) {
  // --- Pre-flight sanity in dev ---
  const missing = [];
  if (!stripeSecret) missing.push("STRIPE_SECRET_KEY");
  // We don't require COUPON_10, it's optional
  // Price vars are validated per-plan below

  try {
    const { user, profile } = await getUserAndProfile();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const plan = String(body?.plan || "").toLowerCase();
    const price = PLAN_TO_PRICE[plan];

    if (!plan || !price) {
      if (!price) missing.push(`PRICE_${plan.toUpperCase() || "??"}`);
      const msg = `invalid_plan_or_price: plan="${plan}"`;
      if (process.env.NODE_ENV !== "production") {
        return NextResponse.json({ error: msg, missing }, { status: 400 });
      }
      return NextResponse.json({ error: "invalid_plan" }, { status: 400 });
    }
    if (missing.length) {
      const msg = `missing_env: ${missing.join(", ")}`;
      if (process.env.NODE_ENV !== "production") {
        return NextResponse.json({ error: msg }, { status: 500 });
      }
      return NextResponse.json({ error: "server_error" }, { status: 500 });
    }

    // Derive origin (works locally & on Vercel)
    const h = await headers();
    const origin = originFrom(h);

    // Discounts (student takes precedence; else referral credit)
    const isEdu = (user.email || "").toLowerCase().endsWith(".edu");
    const isStudent = profile?.is_student || isEdu;
    const hasReferralCredit = (profile?.referral_credit_available || 0) > 0;

    const discounts = [];
    let used_referral_credit = "0";
    if (isStudent && process.env.COUPON_10) {
      discounts.push({ coupon: process.env.COUPON_10 });
    } else if (hasReferralCredit && process.env.COUPON_10) {
      discounts.push({ coupon: process.env.COUPON_10 });
      used_referral_credit = "1";
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      allow_promotion_codes: true,
      automatic_tax: { enabled: true },
      customer_email: user.email ?? undefined,
      line_items: [{ price, quantity: 1 }],
      ...(discounts.length ? { discounts } : {}),
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/plans?canceled=1`,
      metadata: {
        user_id: user.id,
        email: user.email || "",
        plan,
        used_referral_credit,
        ref_code: body?.ref || "",
      },
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (e) {
    console.error("checkout error", e);
    if (process.env.NODE_ENV !== "production") {
      // Helpful message during local dev
      return NextResponse.json({ error: e.message || "server_error" }, { status: 500 });
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

