import Stripe from "stripe";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getUserAndProfile } from "../../../lib/supabaseServerClient.js"; 
import { createSupabaseAdmin } from "../../../lib/supabaseAdmin.js";       
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-06-20",
});

export async function POST() {
  try {
    const { user, profile } = await getUserAndProfile();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    // Try stored customer id first
    let customerId = profile?.stripe_customer_id || null;

    // If missing, try to find by email and persist for next time
    if (!customerId && user.email) {
      const found = await stripe.customers.list({ email: user.email, limit: 1 });
      if (found.data?.length) {
        customerId = found.data[0].id;
        const admin = createSupabaseAdmin();
        await admin.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
      }
    }

    if (!customerId) return NextResponse.json({ error: "no_customer" }, { status: 404 });

    // Build return URL from request origin
    const h = await headers();
    const proto = h.get("x-forwarded-proto") || "https";
    const host  = h.get("x-forwarded-host") || h.get("host");
    const origin = `${proto}://${host}`;

    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/dashboard`,
    });

    return NextResponse.json({ url: portal.url }, { status: 200 });
  } catch (e) {
    console.error("portal error", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
