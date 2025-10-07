// /app/api/orders/assign/route.js  (POST assign to staff)
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

  const { orderId, staffUserId } = await req.json().catch(() => ({}));
  if (!orderId || !staffUserId) return NextResponse.json({ error: "orderId and staffUserId required" }, { status: 400 });

  const { data, error } = await supabase.rpc("orders_admin_assign", { p_order_id: orderId, p_staff_user_id: staffUserId });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: !!data });
}
 