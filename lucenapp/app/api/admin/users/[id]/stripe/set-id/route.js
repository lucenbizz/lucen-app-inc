// /app/api/admin/users/[id]/stripe/set-id/route.js  (NEW)
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function POST(req, { params }) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const [{ data: isExec }, { data: isAdmin }] = await Promise.all([
    supabase.rpc("is_executive").catch(() => ({ data: false })),
    supabase.rpc("is_admin").catch(() => ({ data: false })),
  ]);
  if (!(isExec || isAdmin)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const userId = params.id;
  const { accountId } = await req.json().catch(()=> ({}));
  if (!userId || !accountId) return NextResponse.json({ error: "user id and accountId required" }, { status: 400 });
  if (!/^acct_[A-Za-z0-9]+$/.test(accountId)) return NextResponse.json({ error: "Invalid Stripe account id" }, { status: 400 });

  const { error } = await supabase
    .from("profiles")
    .update({ stripe_account_id: accountId })
    .eq("id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  try {
    await supabase.from("audit_log").insert({
      actor_id: session.user.id,
      action: "users.stripe.set_id",
      meta: { userId, accountId },
    });
  } catch {}

  return NextResponse.json({ ok: true });
}
 