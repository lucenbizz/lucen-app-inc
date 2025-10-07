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

export async function GET() {
  try {
    const store = await cookies();
    const token = store.get(supabaseCookieName())?.value || '';
    const supabase = supabaseWithBearer(token);

    // Restrictive RLS: only owner (exec) sees their invites
    const { data, error } = await supabase
      .from('staff_invites')
      .select('code, active, max_uses, uses, note, created_at, expires_at')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ items: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Failed to list invites' }, { status: 500 });
  }
}
