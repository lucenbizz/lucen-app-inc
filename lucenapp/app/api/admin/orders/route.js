// /app/api/admin/orders/route.js  (GET list with filters)
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
export const runtime = 'nodejs';

function applyDateFilters(q, startDate, endDate) {
  // filter by delivery slot window
  if (startDate) q = q.gte("delivery_slot_at", new Date(`${startDate}T00:00:00.000Z`).toISOString());
  if (endDate) {
    const end = new Date(`${endDate}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    q = q.lt("delivery_slot_at", end.toISOString());
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
  const areaTag = searchParams.get("areaTag") || "";
  const assigned = (searchParams.get("assigned") || "any").toLowerCase(); // any|assigned|unassigned
  const qTerm = searchParams.get("q") || "";
  const startDate = searchParams.get("startDate") || "";
  const endDate = searchParams.get("endDate") || "";

  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit")) || 50));
  const offset = Math.max(0, Number(searchParams.get("offset")) || 0);

  let q = supabase
    .from("orders")
    .select("id,status,delivery_slot_at,area_tag,assigned_staff_id,assigned_at,delivered_at,shipping_name,shipping_city,shipping_address1,price_cents", { count:"exact" })
    .order("delivery_slot_at", { ascending: true })
    .range(offset, offset + limit - 1);

  if (status !== "any") q = q.eq("status", status);
  if (areaTag) q = q.ilike("area_tag", areaTag);
  if (assigned === "assigned") q = q.not("assigned_staff_id", "is", null);
  if (assigned === "unassigned") q = q.is("assigned_staff_id", null);
  q = applyDateFilters(q, startDate, endDate);

  if (qTerm) {
    const term = qTerm.trim();
    const like = `%${term}%`;
    q = q.or([
      `shipping_name.ilike.${like}`,
      `shipping_city.ilike.${like}`,
      `shipping_address1.ilike.${like}`,
    ].join(","));
    // (You can add an id eq match if you often paste UUIDs)
  }

  const { data, error, count } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ items: data || [], count: count || 0, nextOffset: offset + (data?.length || 0) });
}
 