// /app/api/payouts/exec/bulk/route.js
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

const ALLOWED = new Set(["approve", "mark_paid", "void"]);

export async function POST(req) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const [{ data: isExec }, { data: isAdmin }] = await Promise.all([
    supabase.rpc("is_executive").catch(() => ({ data: false })),
    supabase.rpc("is_admin").catch(() => ({ data: false })),
  ]);
  if (!(isExec || isAdmin)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { action, ids } = await req.json().catch(() => ({}));
  if (!ALLOWED.has(action)) return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ error: "ids required" }, { status: 400 });

  let patch = {};
  if (action === "approve") patch = { status: "approved", paid_at: null };
  if (action === "mark_paid") patch = { status: "paid", paid_at: new Date().toISOString() };
  if (action === "void") patch = { status: "void", paid_at: null };

  const { error } = await supabase
    .from("exec_payouts")
    .update(patch)
    .in("id", ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Optional: try to write an audit row if your table exists (ignore failures)
  try {
    await supabase.from("audit_log").insert({
      actor_id: session.user.id,
      action: `exec_payouts.bulk.${action}`,
      meta: { ids },
    });
  } catch {}

  return NextResponse.json({ ok: true, count: ids.length });
}
