// middleware.js
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Optional: set DISABLE_STAFF_GUARD=1 to bypass locally
const DISABLE_GUARD = process.env.DISABLE_STAFF_GUARD === '1';

export async function middleware(req) {
  if (DISABLE_GUARD) return NextResponse.next();

  const { pathname, search } = req.nextUrl;
  const res = NextResponse.next();

  // Edge-safe SSR client (no Node APIs)
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get: (name) => req.cookies.get(name)?.value,
      set: (name, value, options) => {
        res.cookies.set({ name, value, ...options });
      },
      remove: (name, options) => {
        res.cookies.set({ name, value: '', ...options });
      },
    },
  });

  // 1) Must be signed in
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const redirectUrl = new URL('/auth/sign-in', req.url);
    redirectUrl.searchParams.set('next', pathname + search);
    return NextResponse.redirect(redirectUrl);
  }

  // 2) Look up role
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (error) {
    // safer to block if profile missing/inaccessible
    return NextResponse.redirect(new URL('/forbidden', req.url));
  }

  const role = profile?.role;
  const isStaffOrAdmin = role === 'staff' || role === 'admin';

  // /admin => admin only
  if (pathname.startsWith('/admin')) {
    if (role !== 'admin') {
      return NextResponse.redirect(new URL('/forbidden', req.url));
    }
    return res;
  }

  // /staff => staff or admin
  if (pathname.startsWith('/staff')) {
    if (!isStaffOrAdmin) {
      return NextResponse.redirect(new URL('/forbidden', req.url));
    }
    return res;
  }

  // default allow
  return res;
}

// Only run this middleware on these routes
export const config = {
  matcher: ['/staff', '/staff/:path*', '/admin', '/admin/:path*'],
};

