// /app/api/payouts/exec/ids/route.js  (UPDATED: supports startDate/endDate filters)
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

const HARD_CAP = 5000;

function applyDateFilters(q, startDate, endDate) {
  if (startDate) q = q.gte("created_at", new Date(`${startDate}T00:00:00.000Z`).toISOString());
  if (endDate) {
    const end = new Date(`${endDate}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    q = q.lt("created_at", end.toISOString());
  }
  return q;
}

export async function GET(req) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const [{ data: isExec }, { data: isAdmin }] = await Promise.all([
    supabase.rpc("is_executive").catch(() => ({ data: false })),
    supabase.rpc("is_admin").catch(() => ({ data: false })),
  ]);
  if (!(isExec || isAdmin)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = (searchParams.get("status") || "any").toLowerCase();
  const startDate = searchParams.get("startDate") || "";
  const endDate = searchParams.get("endDate") || "";
  const limit = Math.min(HARD_CAP, Math.max(1, Number(searchParams.get("limit")) || HARD_CAP));

  let q = supabase
    .from("exec_payouts")
    .select("id", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status !== "any") q = q.eq("status", status);
  q = applyDateFilters(q, startDate, endDate);

  const { data, error, count } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ids: (data || []).map(r => r.id), total: count || 0, capped: (count || 0) > limit });
}
 