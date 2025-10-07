export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

function supabaseCookieName() {
  const ref = (process.env.NEXT_PUBLIC_SUPABASE_URL || '')
    .match(/^https?:\/\/([a-z0-9-]+)\.supabase\.co/i)?.[1] || 'khzbliduummbypuxqnfn';
  return `sb-${ref}-auth-token`;
}
function supabaseWithBearer(token) {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(req) {
  try {
    const { code } = await req.json();
    if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 });

    const store = await cookies();
    const token = store.get(supabaseCookieName())?.value || '';
    const supabase = supabaseWithBearer(token);

    const { data: me } = await supabase.auth.getUser();
    if (!me?.user?.id) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

    const { error } = await supabase.rpc('accept_staff_invite', { p_code: code });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Failed to accept invite' }, { status: 500 });
  }
}
