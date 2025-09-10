// middleware.js
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

function isStaffLike(profile) {
  return !!(
    profile?.is_admin ||
    profile?.is_staff ||
    profile?.role === 'admin' ||
    profile?.role === 'staff'
  );
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  // Only guard these namespaces
  const protectStaff = pathname.startsWith('/Admin') || pathname.startsWith('/staff');
  const guardDashboard = pathname.startsWith('/dashboard');

  // Prepare a mutable response so Supabase can update auth cookies if needed
  const res = NextResponse.next();

  // Supabase SSR client from cookies/headers
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookies) => cookies.forEach(({ name, value, ...opts }) => res.cookies.set(name, value, opts)),
      },
      headers: { get: (k) => req.headers.get(k) || undefined },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Staff/admin spaces require auth + staff role
  if (protectStaff) {
    if (!user) {
      return NextResponse.redirect(
        new URL(`/auth/sign-in?next=${encodeURIComponent(pathname)}`, req.url)
      );
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('role,is_staff,is_admin')
      .eq('id', user.id)
      .single();

    if (!isStaffLike(profile)) {
      return NextResponse.redirect(new URL('/forbidden', req.url));
    }
    return res;
  }

  // Dashboard: require auth but DO NOT enforce staff
  if (guardDashboard) {
    if (!user) {
      return NextResponse.redirect(
        new URL('/auth/sign-in?next=/dashboard', req.url)
      );
    }
    return res;
  }

  return res;
}

// Only run on these routes (note: NOT manifest/sw/static)
export const config = {
  matcher: ['/dashboard/:path*', '/Admin/:path*', '/staff/:path*'],
};
