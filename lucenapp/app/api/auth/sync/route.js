// app/api/auth/sync/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

async function syncAuth() {
  const store = cookies(); // synchronous
  const supabase = createRouteHandlerClient({ cookies: () => store });
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) return { ok: false, error: error.message };
  return { ok: true, hasSession: !!session };
}

export async function GET() {
  const data = await syncAuth();
  return NextResponse.json(data, { status: 200 });
}

export async function POST() {
  const data = await syncAuth();
  return NextResponse.json(data, { status: 200 });
}
