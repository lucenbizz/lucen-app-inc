// /app/api/payments/webhook/route.js  (UPDATED to also compute exec payout & persist capture amounts)
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { DELIVERY_PAYOUT_CENTS, EBOOK_PRICE_CENTS } from "../../../lib/pricing";

// ---- service supabase (service role) ----
function serviceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Service role not configured");
  return createClient(url, key, { auth: { persistSession: false } });
}

// ---- Loyalty commit helper (reuses your earlier function) ----
async function commitReservationAndAward(supabase, { payment_intent_id, amount_paid_cents, purchase_tier = "bronze", order_id = null }) {
  // lookup reservation by PI
  const { data: r, error: rErr } = await supabase
    .from("loyalty_reservations")
    .select("*")
    .eq("payment_intent_id", payment_intent_id)
    .single();
  if (rErr || !r) throw new Error("Reservation not found for payment_intent_id");

  // Commit reservation (burn points) + award earn on the net amount paid
  const { data, error } = await supabase.rpc("loyalty_commit", {
    reservation_id: r.id,
    amount_paid_cents: Number(amount_paid_cents || 0),
    purchase_tier: purchase_tier,
    order_id: order_id || null,
    payment_intent_id,
  });
  if (error) throw new Error(error.message);
  return { reservation: r, commitResult: data?.[0] || data || null };
}

// ---- Order + exec payout capture helper ----
async function upsertOrderAndExecPayout(supabase, { user_id, tier, payment_intent_id, amount_paid_cents, reservation }) {
  const tierKey = String(tier || "bronze").toLowerCase();
  const delivery = DELIVERY_PAYOUT_CENTS[tierKey] || 0;

  // Reconstruct price & discount: price = amount_paid + reservation.value_cents
  const price_cents = Number(amount_paid_cents || 0) + Number(reservation?.value_cents || 0);
  const discount_cents = Number(reservation?.value_cents || 0);
  const net_paid_cents = Number(amount_paid_cents || 0);

  // 1) Ensure an order exists: if a metadata order_id was provided earlier, use it; otherwise create a minimal one.
  //    We also store delivery_payout_cents now based on tier.
  let orderId = null;

  // Try to find existing order by PI
  const { data: existingOrder } = await supabase
    .from("orders")
    .select("id")
    .eq("payment_intent_id", payment_intent_id)
    .maybeSingle();

  if (existingOrder?.id) {
    orderId = existingOrder.id;
    // update capture fields
    await supabase
      .from("orders")
      .update({
        price_cents,
        discount_cents,
        net_paid_cents,
        delivery_payout_cents: delivery,
        exec_share_cents: 0,
        platform_share_cents: 0,
        payout_locked: false,
        payout_calculated_at: null,
      })
      .eq("id", orderId);
  } else {
    // Create minimal order row (you can enrich with address, cart lines, etc. earlier in the flow)
    const { data: created, error: createErr } = await supabase
      .from("orders")
      .insert({
        customer_id: user_id,
        tier: tierKey,
        status: "paid",                     // mark paid; your fulfillment flow can move it to 'scheduled' etc.
        payment_intent_id,
        price_cents,
        discount_cents,
        net_paid_cents,
        delivery_payout_cents: delivery,
      })
      .select("id")
      .single();
    if (createErr) throw new Error(createErr.message);
    orderId = created.id;
  }

  // 2) Compute and create/refresh Exec payout (atomic in DB)
  const { error: payoutErr } = await supabase.rpc("create_or_update_exec_payout", {
    p_order_id: orderId,
    p_exec_user_id: null, // admin can assign specific exec later; or store a default exec in app_settings and look it up
  });
  if (payoutErr) throw new Error(payoutErr.message);

  return { orderId, price_cents, discount_cents, net_paid_cents, delivery_payout_cents: delivery };
}

// ---- Webhook entrypoint ----
export async function POST(req) {
  const supabase = serviceSupabase();
  const sig = req.headers.get("stripe-signature");
  const raw = await req.text();

  // Stripe path (if configured)
  if (sig && process.env.STRIPE_WEBHOOK_SECRET && process.env.STRIPE_SECRET_KEY) {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });
    let event;
    try {
      event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (e) {
      return NextResponse.json({ error: `Stripe signature verification failed: ${e.message}` }, { status: 400 });
    }

    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object;
      const amount = pi.amount_received;
      const tier = (pi.metadata && pi.metadata.tier) || "bronze";
      const user_id = (pi.metadata && pi.metadata.user_id) || null;

      try {
        // 1) Loyalty reserve commit + earn
        const { reservation } = await commitReservationAndAward(supabase, {
          payment_intent_id: pi.id, amount_paid_cents: amount, purchase_tier: tier,
        });

        // 2) Upsert order (capture fields) + exec payout
        await upsertOrderAndExecPayout(supabase, {
          user_id, tier, payment_intent_id: pi.id, amount_paid_cents: amount, reservation,
        });

        return NextResponse.json({ ok: true });
      } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
    }

    return NextResponse.json({ ok: true });
  }

  // DEMO path (for local testing without Stripe)
  let json = {};
  try { json = JSON.parse(raw || "{}"); } catch { json = {}; }
  if (json?.provider === "demo" && json?.type === "payment.succeeded") {
    const { payment_intent_id, amount_cents, purchaseTier = "bronze", userId = null } = json;
    try {
      const { reservation } = await commitReservationAndAward(supabase, {
        payment_intent_id, amount_paid_cents: amount_cents, purchase_tier: purchaseTier,
      });
      await upsertOrderAndExecPayout(supabase, {
        user_id: userId, tier: purchaseTier, payment_intent_id, amount_paid_cents: amount_cents, reservation,
      });
      return NextResponse.json({ ok: true });
    } catch (e) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true });
}
