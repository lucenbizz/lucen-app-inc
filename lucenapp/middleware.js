// middleware.js
import { NextResponse } from 'next/server';

export const config = {
  matcher: [
    '/account/:path*',
    '/admin/:path*',
    '/staff/:path*',
  ],
};

export function middleware(req) {
  // Very light auth check: look for Supabase auth cookies only.
  const hasSession =
    req.cookies.get('sb-access-token') ||
    req.cookies.get('supabase-auth-token'); // depending on your cookie names

  if (!hasSession && (req.nextUrl.pathname.startsWith('/account') || req.nextUrl.pathname.startsWith('/staff'))) {
    const url = req.nextUrl.clone();
    url.pathname = '/sign-in';
    url.searchParams.set('redirect', req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}
