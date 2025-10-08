// app/auth/callback/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

// optional: centralize this (or just inline it)
function redirectTo(request, path) {
  const url = new URL(path, request.url);
  return NextResponse.redirect(url);
}

export async function GET(request) {
  // Read params Supabase may send
  const url = new URL(request.url);
  const code = url.searchParams.get('code');                 // OAuth + PKCE + magic-link
  const token_hash = url.searchParams.get('token_hash');     // Email confirm/recovery/email_change/invite
  const typeParam = url.searchParams.get('type');            // e.g. 'recovery','email_change','invite','email'
  const next = url.searchParams.get('next') || '/dashboard'; // where to go after success

  // Create Supabase server client that can write auth cookies
  const store = await cookies();
  const supabase = createRouteHandlerClient({ cookies: () => store });

  // Try PKCE/code first
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return redirectTo(request, next);
    // fall through to error
  }

  // Then try token_hash flows (email confirmation / recovery / email_change / invite)
  if (token_hash) {
    // If provider sent a specific type, try it; otherwise try a few common ones.
    const types = typeParam
      ? [typeParam]
      : ['email', 'recovery', 'email_change', 'invite', 'magiclink'];

    for (const t of types) {
      const { error } = await supabase.auth.verifyOtp({ type: t, token_hash });
      if (!error) return redirectTo(request, next);
    }
  }

  // Nothing worked → back to sign-in with a friendly error
  const err = code || token_hash ? 'auth_callback_failed' : 'no_auth_params';
  return redirectTo(request, `/sign-in?error=${encodeURIComponent(err)}`);
}
