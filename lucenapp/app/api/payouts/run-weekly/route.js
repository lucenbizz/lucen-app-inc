// /app/api/payouts/run-weekly/route.js  (NEW)
// Triggers WEEKLY payouts: aggregates approved+unpaid rows, optionally creates Stripe Transfers,
// then marks rows paid. Supports dryRun.
//
// POST body:
// { startDate: "YYYY-MM-DD", endDate: "YYYY-MM-DD", dryRun?: true }
// - Inclusive start, exclusive end at 00:00Z boundaries.
// - If you want local/Eastern boundaries, pass the correct dates from the UI.
//
// Response: { period:{start,end}, dryRun, staff:{...}, exec:{...} }
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { getStripe } from "../../../lib/stripe";
export const runtime = 'nodejs';

function dayStartIso(d){ return new Date(`${d}T00:00:00.000Z`).toISOString(); }
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function dayEndExclusiveIso(d){
  const end = new Date(`${d}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  return end.toISOString();
}

async function fetchPublicUsers(supabase, userIds){
  if (!userIds?.length) return {};
  const { data, error } = await supabase.rpc("user_public_batch", { uids: userIds }).catch(() => ({ data: null, error: null }));
  if (error || !data) return {};
  return Object.fromEntries(data.map(u => [u.id, u]));
}

export async function POST(req) {
  const supabase = createRouteHandlerClient({ cookies });

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Exec/Admin only
  const [{ data: isExec }, { data: isAdmin }] = await Promise.all([
    supabase.rpc("is_executive").catch(() => ({ data: false })),
    supabase.rpc("is_admin").catch(() => ({ data: false })),
  ]);
  if (!(isExec || isAdmin)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(()=> ({}));
  const startDate = body.startDate;
  const endDate   = body.endDate;
  const dryRun    = !!body.dryRun;

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "startDate and endDate are required (YYYY-MM-DD)" }, { status: 400 });
  }

  const startIso = dayStartIso(startDate);
  const endIso   = dayStartIso(endDate); // exclusive end => pass next day (UI does this for us) OR use endDate as exclusive
  // If caller passes an inclusive end, they should add +1 day. We'll keep docs simple in UI.

  // 1) Aggregate staff & exec payouts for the window
  const [{ data: staffAgg, error: staffErr }, { data: execAgg, error: execErr }] = await Promise.all([
    supabase.rpc("payouts_sum_staff", { p_start: startIso, p_end: endIso }),
    supabase.rpc("payouts_sum_exec",  { p_start: startIso, p_end: endIso }),
  ]);
  if (staffErr) return NextResponse.json({ error: staffErr.message }, { status: 400 });
  if (execErr)  return NextResponse.json({ error: execErr.message }, { status: 400 });

  const staffUsers = (staffAgg || []).map(r => r.user_id);
  const execUsers  = (execAgg  || []).map(r => r.user_id);
  const allUsers = Array.from(new Set([...staffUsers, ...execUsers]));

  // 2) Get Stripe connected account ids for all participants
  const { data: stripeRows, error: stripeErr } = await supabase.rpc("user_get_stripe_accounts", { uids: allUsers });
  if (stripeErr) return NextResponse.json({ error: stripeErr.message }, { status: 400 });
  const acctByUser = Object.fromEntries((stripeRows || []).map(r => [r.user_id, r.stripe_account_id || null]));

  // 3) (Optional) Public names/emails for nicer summary
  const publicByUser = await fetchPublicUsers(supabase, allUsers);

  // Prepare Stripe client if not dry-run
  let stripe = null;
  if (!dryRun) {
    try { stripe = getStripe(); }
    catch(e){ return NextResponse.json({ error: e.message || "Stripe not configured" }, { status: 400 }); }
  }

  const period = { start: startIso, end: endIso };
  const results = {
    period,
    dryRun,
    staff: { totalCents: 0, transfers: [], missing: [] },
    exec:  { totalCents: 0, transfers: [], missing: [] }
  };

  async function processRole(role, rows) {
    for (const r of (rows || [])) {
      const userId = r.user_id;
      const totalCents = Number(r.total_cents || 0);
      const ids = r.ids || [];
      const metaUser = publicByUser[userId] || {};
      const stripeAccount = acctByUser[userId] || null;

      if (!totalCents || ids.length === 0) continue;

      const rec = {
        userId,
        name: metaUser.name || null,
        email: metaUser.email || null,
        totalCents,
        count: Number(r.row_count || ids.length),
        stripeAccountId: stripeAccount,
        transferId: null,
        markedCount: 0
      };

      if (!stripeAccount) {
        results[role].missing.push(rec);
        continue;
      }

      if (dryRun) {
        results[role].transfers.push({ ...rec, transferId: "(dry-run)" });
        results[role].totalCents += totalCents;
        continue;
      }

      // Real transfer
      const idempotencyKey = [
        "weekly", role, userId, startDate, endDate, totalCents
      ].join(":");

      try {
        const transfer = await stripe.transfers.create({
          amount: totalCents,
          currency: "usd",
          destination: stripeAccount,
          description: `Lucen weekly ${role} payout ${startDate}→${endDate}`,
          metadata: {
            role,
            user_id: userId,
            period_start: startDate,
            period_end: endDate,
            rows: String(ids.length)
          }
        }, { idempotencyKey });

        // Mark rows paid
        const rpc = role === "staff" ? "payouts_mark_staff_paid" : "payouts_mark_exec_paid";
        const { data: marked, error: markErr } = await supabase.rpc(rpc, { p_ids: ids, p_transfer_id: transfer.id });
        if (markErr) throw markErr;

        results[role].transfers.push({ ...rec, transferId: transfer.id, markedCount: marked || 0 });
        results[role].totalCents += totalCents;
      } catch (e) {
        results[role].transfers.push({ ...rec, error: e.message || String(e) });
      }
    }
  }

  await processRole("staff", staffAgg);
  await processRole("exec", execAgg);

  // Audit (best-effort)
  try {
    await supabase.from("audit_log").insert({
      actor_id: session.user.id,
      action: dryRun ? "payouts.weekly.dry_run" : "payouts.weekly.run",
      meta: results
    });
  } catch {}

  return NextResponse.json(results);
}
