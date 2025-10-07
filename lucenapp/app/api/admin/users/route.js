// /app/api/admin/users/route.js  (NEW)  -> list/search users + stripe cache
export const runtime = 'nodejs';
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";


// status filter helper
function computeBadge({ stripe_account_id, stripe_connect_status }) {
  if (!stripe_account_id) return "missing";
  const s = stripe_connect_status || {};
  const payoutsEnabled = !!s.payouts_enabled;
  const needs = (s.requirements?.currently_due || []).length;
  if (payoutsEnabled) return "complete";
  if (needs > 0) return "restricted";
  return "pending";
}

export async function GET(req) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Exec/Admin only
  const [{ data: isExec }, { data: isAdmin }] = await Promise.all([
    supabase.rpc("is_executive").catch(() => ({ data: false })),
    supabase.rpc("is_admin").catch(() => ({ data: false })),
  ]);
  if (!(isExec || isAdmin)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const status = (searchParams.get("status") || "any").toLowerCase(); // any|missing|pending|restricted|complete
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 20));
  const offset = Math.max(0, Number(searchParams.get("offset")) || 0);

  // Use existing search RPC for auth.users
  const { data: found, error } = await supabase.rpc("user_search_users", { q, lim: limit + offset });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const page = (found || []).slice(offset, offset + limit);
  const ids = page.map(u => u.id);
  const { data: profs } = ids.length
    ? await supabase.rpc("profiles_get_batch", { uids: ids })
    : { data: [] };

  const profById = Object.fromEntries((profs || []).map(p => [p.id, p]));
  let items = page.map(u => {
    const p = profById[u.id] || {};
    const badge = computeBadge({ stripe_account_id: p.stripe_account_id, stripe_connect_status: p.stripe_connect_status });
    return {
      id: u.id,
      name: u.name || null,
      email: u.email || null,
      stripe_account_id: p.stripe_account_id || null,
      stripe_status_synced_at: p.stripe_status_synced_at || null,
      stripe_badge: badge,
      stripe_connect_status: p.stripe_connect_status || null,
    };
  });

  if (status !== "any") items = items.filter(it => it.stripe_badge === status);

  return NextResponse.json({
    items,
    count: items.length, // since we drive by search, we return filtered count only
    nextOffset: offset + items.length,
  });
}
 