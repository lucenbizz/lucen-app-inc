// /app/api/loyalty/preview/route.js
export const runtime = 'nodejs';
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function GET(req) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const points = Number(searchParams.get('points') || 0);
  const { data: value, error } = await supabase.rpc('loyalty_preview_value', { points });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ valueCents: value || 0 });
}
 