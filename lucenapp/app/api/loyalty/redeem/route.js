// /app/api/loyalty/redeem/route.js
export const runtime = 'nodejs';
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function POST(req) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { points, orderId } = await req.json().catch(() => ({}));
  const n = Number(points || 0);
  if (!Number.isFinite(n) || n <= 0) return NextResponse.json({ error: 'points required' }, { status: 400 });

  const { data: value, error } = await supabase.rpc('loyalty_redeem', {
    points_to_spend: n,
    order_id: orderId || null,
    reason: 'order-discount',
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const { data: summary } = await supabase.rpc('loyalty_get_summary');
  return NextResponse.json({ ok: true, valueCents: value || 0, summary: summary?.[0] || null });
}
 