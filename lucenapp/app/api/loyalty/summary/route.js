// app/api/loyalty/summary/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

function supabaseCookieName() {
  const ref =
    (process.env.NEXT_PUBLIC_SUPABASE_URL || '').match(
      /^https?:\/\/([a-z0-9-]+)\.supabase\.co/i
    )?.[1] || 'khzbliduummbypuxqnfn';
  return `sb-${ref}-auth-token`;
}
function supabaseWithBearer(token) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      auth: { persistSession: false, autoRefreshToken: false } }
  );
}
function jsonError(msg, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function GET() {
  try {
    const store = await cookies();                                // <-- await
    const token = store.get(supabaseCookieName())?.value || '';
    const supabase = supabaseWithBearer(token);

    const { data: me, error: meErr } = await supabase.auth.getUser();
    if (meErr || !me?.user?.id) return jsonError('Not signed in', 401);
    const uid = me.user.id;

    // Try a balances table first
    let points_balance = 0;

    let r = await supabase
      .from('loyalty_balances')
      .select('points_balance')
      .eq('user_id', uid)
      .limit(1);
    if (!r.error && Array.isArray(r.data) && r.data.length) {
      points_balance = Number(r.data[0].points_balance || 0);
    } else {
      // Fallback: sum events if balances table missing
      const ev = await supabase
        .from('loyalty_events')
        .select('points_delta')
        .eq('user_id', uid);
      if (!ev.error && Array.isArray(ev.data)) {
        points_balance = ev.data.reduce((sum, row) => sum + Number(row.points_delta || 0), 0);
      }
    }

    return NextResponse.json({ summary: { points_balance } });
  } catch (e) {
    return jsonError((e && e.message) || 'Unexpected error', 500);
  }
}
