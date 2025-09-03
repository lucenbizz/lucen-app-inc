import Stripe from "stripe";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getUser } from "../../../lib/supabaseServerClient.js"; // if no path alias, use: "../../../../lib/supabaseServerClient.js"

export const runtime = "nodejs";        // Stripe needs Node runtime
export const dynamic = "force-dynamic"; // don't cache

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-06-20",
});

// Map to your ONE-TIME Price IDs (Option A)
const PLAN_TO_PRICE = {
  bronze: process.env.PRICE_BRONZE,
  silver: process.env.PRICE_SILVER,
  gold:   process.env.PRICE_GOLD,
  black:  process.env.PRICE_BLACK, // $475
};

export async function POST(req) {
  try {
    const { user } = await getUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const plan = String(body?.plan || "").toLowerCase();
    const price = PLAN_TO_PRICE[plan];
    if (!price) return NextResponse.json({ error: "invalid_plan" }, { status: 400 });

    // Derive the origin so it works on Vercel previews & prod
    const h = await headers();
    const proto = h.get("x-forwarded-proto") || "https";
    const host  = h.get("x-forwarded-host") || h.get("host");
    const origin = `${proto}://${host}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      allow_promotion_codes: true,
      automatic_tax: { enabled: true }, // you said Auto-Tax is on
      customer_email: user.email ?? undefined,
      line_items: [{ price, quantity: 1 }],
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/plans?canceled=1`,
      metadata: {
        user_id: user.id,
        email: user.email || "",
        plan, // bronze | silver | gold | black
      },
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (e) {
    console.error("checkout error", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
