// /app/api/orders/update-slot/route.js  (POST)
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
export const runtime = 'nodejs';

export async function POST(req) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const [{ data: isExec }, { data: isAdmin }] = await Promise.all([
    supabase.rpc("is_executive").catch(() => ({ data: false })),
    supabase.rpc("is_admin").catch(() => ({ data: false })),
  ]);
  if (!(isExec || isAdmin)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { orderId, slotIso, areaTag } = await req.json().catch(() => ({}));
  if (!orderId || !slotIso) return NextResponse.json({ error: "orderId and slotIso required" }, { status: 400 });

  const { data, error } = await supabase.rpc("orders_admin_update_slot", { p_order_id: orderId, p_slot: slotIso, p_area_tag: areaTag || null });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: !!data });
}
 