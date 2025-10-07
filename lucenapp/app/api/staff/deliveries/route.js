// /app/api/staff/deliveries/route.js  (list upcoming deliveries for staff)
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
export const runtime = 'nodejs';

export async function GET(req) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: isStaff } = await supabase.rpc("is_staff").catch(() => ({ data: false }));
  const { data: isExec }  = await supabase.rpc("is_executive").catch(() => ({ data: false }));
  const { data: isAdmin } = await supabase.rpc("is_admin").catch(() => ({ data: false }));
  if (!(isStaff || isExec || isAdmin)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const onlyMine = searchParams.get("onlyMine") === "1";
  const hours = Math.min(168, Math.max(1, Number(searchParams.get("hours") || 48))); // default 48h window

  const now = new Date();
  const until = new Date(now.getTime() + hours*3600*1000);

  let q = supabase
    .from("orders")
    .select("id, status, delivery_slot_at, area_tag, assigned_staff_id, shipping_name, shipping_city, shipping_address1, price_cents", { count: "exact" })
    .in("status", ["paid","scheduled"])
    .gte("delivery_slot_at", now.toISOString())
    .lt("delivery_slot_at", until.toISOString())
    .order("delivery_slot_at", { ascending: true });

  if (onlyMine) {
    q = q.eq("assigned_staff_id", session.user.id);
  } else {
    // show unassigned OR mine
    q = q.or(`assigned_staff_id.is.null,assigned_staff_id.eq.${session.user.id}`);
  }

  const { data, error, count } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ items: data || [], count: count || 0 });
}
