// /app/api/orders/mark-fulfilled/route.js
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function POST(req) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { orderId } = await req.json().catch(() => ({}));
  if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

  const { data, error } = await supabase.rpc("orders_mark_fulfilled", { p_order_id: orderId });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: !!data });
}
 