// app/api/auth/sync/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export async function GET() {
  const store = await cookies();
  const supabase = createRouteHandlerClient({ cookies: () => store });
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 200 });
  return NextResponse.json({ ok: true, hasSession: !!session }, { status: 200 });
}
