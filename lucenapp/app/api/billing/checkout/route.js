import Stripe from "stripe";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getUserAndProfile } from "../../../lib/supabaseServerClient.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-06-20",
});

const PLAN_TO_PRICE = {
  bronze: process.env.PRICE_BRONZE,
  silver: process.env.PRICE_SILVER,
  gold:   process.env.PRICE_GOLD,
  black:  process.env.PRICE_BLACK,
};

export async function POST(req) {
  try {
    const { user, profile } = await getUserAndProfile();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const plan = String(body?.plan || "").toLowerCase();
    const price = PLAN_TO_PRICE[plan];
    if (!price) return NextResponse.json({ error: "invalid_plan" }, { status: 400 });

    // derive origin for success/cancel URLs (works on Vercel preview + prod)
    const h = await headers();
    const proto = h.get("x-forwarded-proto") || "https";
    const host  = h.get("x-forwarded-host") || h.get("host");
    const origin = `${proto}://${host}`;

    // Decide discount (no stacking): student first; else referral credit if available
    const isEdu = (user.email || "").toLowerCase().endsWith(".edu");
    const isStudent = profile?.is_student || isEdu;
    const hasReferralCredit = (profile?.referral_credit_available || 0) > 0;

    const discounts = [];
    let used_referral_credit = "0";
    if (isStudent) {
      if (!process.env.COUPON_10) {
        console.warn("COUPON_10 not set; student discount will not apply");
      } else {
        discounts.push({ coupon: process.env.COUPON_10 });
      }
    } else if (hasReferralCredit) {
      if (!process.env.COUPON_10) {
        console.warn("COUPON_10 not set; referral discount will not apply");
      } else {
        discounts.push({ coupon: process.env.COUPON_10 });
        used_referral_credit = "1";
      }
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
        ref_code: body?.ref || "", // should be a referrer's user_id if present
      },
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (e) {
    console.error("checkout error", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

