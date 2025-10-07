// app/api/auth/sync/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

function cookieNames() {
  // Derive your Supabase project ref from the URL env
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const m = url.match(/^https?:\/\/([a-z0-9-]+)\.supabase\.co/i);
  const ref = m?.[1] || 'khzbliduummbypuxqnfn'; // fallback to your ref
  return {
    auth: `sb-${ref}-auth-token`,
    refresh: `sb-${ref}-refresh-token`,
  };
}

export async function POST(req) {
  const { access_token, refresh_token, expires_at } = await req.json();

  if (!access_token || !refresh_token) {
    return NextResponse.json({ error: 'Missing tokens' }, { status: 400 });
  }

  const { auth, refresh } = cookieNames();

  const res = NextResponse.json({ ok: true });

  const opts = {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    ...(expires_at ? { expires: new Date(expires_at * 1000) } : {}),
  };

  res.cookies.set(auth, access_token, opts);
  res.cookies.set(refresh, refresh_token, opts);

  return res;
}

