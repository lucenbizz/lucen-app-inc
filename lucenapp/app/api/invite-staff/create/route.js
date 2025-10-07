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
function randomCode(prefix = 'STAFF') {
  const s = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${s}`;
}

export async function POST(req) {
  try {
    const { maxUses = 1, note = null, expiresAt = null } = await req.json().catch(() => ({}));

    const store = await cookies();
    const token = store.get(supabaseCookieName())?.value || '';
    const supabase = supabaseWithBearer(token);

    // who am I?
    const { data: me } = await supabase.auth.getUser();
    const uid = me?.user?.id;
    if (!uid) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

    // role check
    const { data: prof, error: pe } = await supabase
      .from('profiles')
      .select('is_admin,is_executive')
      .eq('user_id', uid)
      .single();
    if (pe) throw pe;
    if (!prof?.is_admin && !prof?.is_executive) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const code = randomCode();
    const insert = {
      code,
      exec_id: uid,
      max_uses: Math.max(1, Number(maxUses) || 1),
      note,
      ...(expiresAt ? { expires_at: new Date(expiresAt) } : {}),
    };

    const { error: insErr } = await supabase.from('staff_invites').insert(insert);
    if (insErr) throw insErr;

    const origin = process.env.NEXT_PUBLIC_APP_ORIGIN || req.nextUrl.origin;
    const link = `${origin}/auth/sign-in?sref=${encodeURIComponent(code)}&redirect=%2Fdashboard`;

    return NextResponse.json({ code, link });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Failed to create staff invite' }, { status: 500 });
  }
}
