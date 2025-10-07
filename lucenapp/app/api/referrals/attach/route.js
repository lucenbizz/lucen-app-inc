export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

function supabaseCookieName() {
  const ref = (process.env.NEXT_PUBLIC_SUPABASE_URL || '')
    .match(/^https?:\/\/([a-z0-9-]+)\.supabase\.co/i)?.[1]
    || 'khzbliduummbypuxqnfn';
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

    // Resolve code → exec_id (must be active)
    const { data: refc, error: rcErr } = await supabase
      .from('referral_codes')
      .select('exec_id, active')
      .eq('code', code)
      .single();
    if (rcErr) throw rcErr;
    if (!refc?.active) return NextResponse.json({ error: 'Code inactive' }, { status: 400 });

    // Current user
    const { data: me, error: meErr } = await supabase.auth.getUser();
    if (meErr) throw meErr;
    const uid = me?.user?.id;
    if (!uid) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

    // Set referrer if not set yet
    const { data: prof, error: selErr } = await supabase
      .from('profiles')
      .select('referrer_exec_id')
      .eq('user_id', uid)
      .single();
    if (selErr) throw selErr;

    if (prof?.referrer_exec_id) {
      // already attached — don’t overwrite
      return NextResponse.json({ ok: true, status: 'already_attached' });
    }

    const { error: upErr } = await supabase
      .from('profiles')
      .update({ referrer_exec_id: refc.exec_id })
      .eq('user_id', uid);
    if (upErr) throw upErr;

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Failed to attach referral' }, { status: 500 });
  }
}
  