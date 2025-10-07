export const runtime = 'nodejs';
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createExpressAccount, createOnboardingLink } from "../../../../../../../lib/stripeConnect";


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
  if (!userId) return NextResponse.json({ error: "user id required" }, { status: 400 });

  // Fetch user public info for email/name
  const { data: users } = await supabase.rpc("user_public_batch", { uids: [userId] }).catch(()=>({ data: [] }));
  const u = users?.[0] || {};
  const email = u.email || null;
  const name  = u.name || null;

  try {
    const acct = await createExpressAccount({ email, name });
    const { error: upErr } = await supabase.from("profiles")
      .update({ stripe_account_id: acct.id })
      .eq("id", userId);
    if (upErr) throw upErr;

    const link = await createOnboardingLink({ accountId: acct.id });

    try {
      await supabase.from("audit_log").insert({
        actor_id: session.user.id,
        action: "users.stripe.create_express",
        meta: { userId, acct: acct.id },
      });
    } catch {}

    return NextResponse.json({ accountId: acct.id, onboardingUrl: link.url });
  } catch (e) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 400 });
  }
}
