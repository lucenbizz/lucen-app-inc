// middleware.js
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

// Apply broadly so the auth cookie stays in sync everywhere.
// (Excludes static assets/images for performance.)
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images|assets).*)'],
};

export async function middleware(req) {
  const res = NextResponse.next();

  // Next.js 15: cookies() must be awaited; pass a function to auth-helpers
  const store = await cookies();
  const supabase = createMiddlewareClient({ req, res, cookies: () => store });

  // Touch session so refresh tokens / auth cookies are synchronized on every request
  const { data: { session } = { session: null } } =
    (await supabase.auth.getSession().catch(() => ({ data: { session: null } }))) || {};

  const url = req.nextUrl;
  const path = url.pathname;

  // Routes that require authentication
  const requiresAuth =
    path.startsWith('/account') ||
    path.startsWith('/admin') ||
    path.startsWith('/staff');

  // If a protected route and not signed in -> send to /sign-in with return URL
  if (requiresAuth && !session) {
    const redirectUrl = new URL('/sign-in', url);
    redirectUrl.searchParams.set('next', path + url.search);
    return NextResponse.redirect(redirectUrl);
  }

  // Optional UX: if already signed in, keep users out of sign-in pages
  if (session && (path === '/sign-in' || path === '/auth/sign-in')) {
    const next = url.searchParams.get('next') || '/dashboard';
    return NextResponse.redirect(new URL(next, url));
  }

  return res;
}
