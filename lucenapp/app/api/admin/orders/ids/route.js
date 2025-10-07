// /app/api/admin/orders/ids/route.js  (NEW: fetch ids for current filters; for select-all)
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

const HARD_CAP = 5000;

function applyFilters(q, { status, assigned, areaTag, qTerm, startDate, endDate }) {
  if (status && status !== "any") q = q.eq("status", status);
  if (assigned === "assigned") q = q.not("assigned_staff_id", "is", null);
  if (assigned === "unassigned") q = q.is("assigned_staff_id", null);
  if (areaTag) q = q.ilike("area_tag", areaTag);
  if (startDate) q = q.gte("delivery_slot_at", new Date(`${startDate}T00:00:00.000Z`).toISOString());
  if (endDate) {
    const end = new Date(`${endDate}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    q = q.lt("delivery_slot_at", end.toISOString());
  }
  if (qTerm) {
    const like = `%${qTerm}%`;
    q = q.or([
      `shipping_name.ilike.${like}`,
      `shipping_city.ilike.${like}`,
      `shipping_address1.ilike.${like}`,
    ].join(","));
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
  const assigned = (searchParams.get("assigned") || "any").toLowerCase();
  const areaTag = searchParams.get("areaTag") || "";
  const qTerm = searchParams.get("q") || "";
  const startDate = searchParams.get("startDate") || "";
  const endDate = searchParams.get("endDate") || "";

  let q = supabase
    .from("orders")
    .select("id", { count: "exact" })
    .order("delivery_slot_at", { ascending: true })
    .limit(HARD_CAP);

  q = applyFilters(q, { status, assigned, areaTag, qTerm, startDate, endDate });

  const { data, error, count } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ids: (data || []).map(r => r.id), total: count || 0, capped: (count || 0) > HARD_CAP });
}
 