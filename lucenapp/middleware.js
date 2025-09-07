// middleware.js
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// (optional) turn off guard locally for faster iteration
const DISABLE_GUARD = process.env.DISABLE_STAFF_GUARD === '1';

export async function middleware(req) {
  if (DISABLE_GUARD) return NextResponse.next();

  const res = NextResponse.next();

  // Build an SSR client wired to request/response cookies
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get: (name) => req.cookies.get(name)?.value,
      set: (name, value, options) => {
        // Next.js requires setting on the response in middleware
        res.cookies.set({ name, value, ...options });
      },
      remove: (name, options) => {
        res.cookies.set({ name, value: '', ...options });
      },
    },
  });

  // 1) Must be logged in
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const redirectUrl = new URL('/auth/sign-in', req.url);
    redirectUrl.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(redirectUrl);
  }

  // 2) Must be admin or staff
  // Read role from profiles (RLS should allow reading own row; anon key is fine)
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (error) {
    // If profile lookup fails, be safe and block
    return NextResponse.redirect(new URL('/forbidden', req.url));
  }

  const role = profile?.role;
  const isAllowed = role === 'admin' || role === 'staff';

  if (!isAllowed) {
    return NextResponse.redirect(new URL('/forbidden', req.url));
  }

  return res; // allow through
}

// Guard /staff and (optionally) /admin
export const config = {
  matcher: ['/staff', '/staff/:path*', '/admin', '/admin/:path*'],
};
