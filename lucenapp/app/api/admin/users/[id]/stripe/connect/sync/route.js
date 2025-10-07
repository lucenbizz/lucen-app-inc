// /app/api/admin/users/[id]/stripe/connect/sync/route.js  (NEW)
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { fetchAccount } from "../../../../../../../lib/stripeConnect";


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

  const { data: prof } = await supabase.from("profiles").select("stripe_account_id").eq("id", userId).single();
  const accountId = prof?.stripe_account_id;
  if (!accountId) return NextResponse.json({ error: "No stripe_account_id on profile" }, { status: 400 });

  try {
    const acct = await fetchAccount({ accountId });
    // keep only fields we care about for cache
    const cache = {
      payouts_enabled: acct.payouts_enabled,
      requirements: acct.requirements || {},
      capabilities: acct.capabilities || {},
      settings: acct.settings?.payouts?.schedule || {},
    };

    const { error: upErr } = await supabase.from("profiles")
      .update({ stripe_connect_status: cache, stripe_status_synced_at: new Date().toISOString() })
      .eq("id", userId);
    if (upErr) throw upErr;

    return NextResponse.json({ cached: cache });
  } catch (e) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 400 });
  }
}
 