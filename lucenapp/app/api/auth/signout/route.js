// app/api/auth/signout/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

// Derive sb-<ref>-auth-token names from your Supabase URL
function cookieNames() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const m = url.match(/^https?:\/\/([a-z0-9-]+)\.supabase\.co/i);
  const ref = m?.[1] || 'khzbliduummbypuxqnfn';
  return {
    auth: `sb-${ref}-auth-token`,
    refresh: `sb-${ref}-refresh-token`,
  };
}

export async function POST() {
  const { auth, refresh } = cookieNames();
  const res = NextResponse.json({ ok: true });

  // Clear both cookies
  const base = { path: '/', httpOnly: true, secure: true, sameSite: 'lax', maxAge: 0 };
  res.cookies.set(auth, '', base);
  res.cookies.set(refresh, '', base);

  return res;
}
