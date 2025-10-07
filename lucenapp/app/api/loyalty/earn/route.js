// /app/api/loyalty/earn/route.js
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function POST(req) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { amountCents, tier, orderId } = await req.json().catch(() => ({}));
  if (typeof amountCents !== 'number' || amountCents <= 0) {
    return NextResponse.json({ error: 'amountCents required' }, { status: 400 });
  }

  const { data: pts, error } = await supabase.rpc('loyalty_earn_from_order', {
    amount_cents: amountCents,
    purchase_tier: String(tier || 'bronze').toLowerCase(),
    order_id: orderId || null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const { data: summary } = await supabase.rpc('loyalty_get_summary');
  return NextResponse.json({ ok: true, pointsAwarded: pts || 0, summary: summary?.[0] || null });
}
 