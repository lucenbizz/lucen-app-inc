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
function randomCode() {
  // e.g. LUC-3F7K9Q
  const s = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `LUC-${s}`;
}

export async function POST(req) {
  try {
    const store = await cookies();
    const token = store.get(supabaseCookieName())?.value || '';
    const supabase = supabaseWithBearer(token);

    // Role check: exec or admin only
    const { data: prof, error: pe } = await supabase
      .from('profiles')
      .select('is_admin,is_executive')
      .single();
    if (pe) throw pe;
    if (!prof?.is_admin && !prof?.is_executive) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const note = body?.note || null;
    const code = body?.code || randomCode();

    // Insert referral code (owner is current user)
    const { data, error } = await supabase
      .from('referral_codes')
      .insert({ code, exec_id: prof?.user_id || null, note })
      .select('*')
      .single();
    if (error) throw error;

    // Share this link with customers
    const origin = process.env.NEXT_PUBLIC_APP_ORIGIN || (typeof req.nextUrl?.origin === 'string' ? req.nextUrl.origin : '');
    const link = `${origin}/auth/sign-in?ref=${encodeURIComponent(data.code)}&redirect=%2Fdashboard`;

    return NextResponse.json({ code: data.code, link });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Failed to create code' }, { status: 500 });
  }
}
