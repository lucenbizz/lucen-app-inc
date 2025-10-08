// app/auth/callback/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

// Small helper to redirect relative to the current request
function redirectTo(request, path) {
  const url = new URL(path, request.url);
  return NextResponse.redirect(url);
}

export async function GET(request) {
  // Supabase may send either:
  // - ?code=... (PKCE/OAuth/magiclink)
  // - ?token_hash=...&type=signup|recovery|email_change|magiclink|invite (email flows)
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const token_hash = url.searchParams.get('token_hash');
  const typeParam = url.searchParams.get('type');
  const next = url.searchParams.get('next') || '/dashboard';

  const store = await cookies();
  const supabase = createRouteHandlerClient({ cookies: () => store });

  // 1) Handle ?code=... (covers PKCE OAuth/magic links if ever used)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return redirectTo(request, next);
    // fall through to try token_hash, then error-redirect
  }

  // 2) Handle email confirmation/recovery/email_change/invite links
  if (token_hash) {
    // Try the declared type first; otherwise try the common set (order matters)
    const candidates = typeParam
      ? [typeParam]
      : ['signup', 'recovery', 'email_change', 'magiclink', 'invite'];

    for (const t of candidates) {
      const { error } = await supabase.auth.verifyOtp({ type: t, token_hash });
      if (!error) {
        // Session cookies are now set; send the user in
        return redirectTo(request, next);
      }
    }
  }

  // 3) If nothing worked, send back to sign-in with a friendly code
  const err = code || token_hash ? 'auth_callback_failed' : 'no_auth_params';
  return redirectTo(request, `/sign-in?error=${encodeURIComponent(err)}`);
}
