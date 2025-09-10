// lucenapp/middleware.js
import { NextResponse } from 'next/server';

const PUBLIC_PREFIXES = [
  '/home',
  '/auth',
  '/api/health',      // keep your health check public
  '/manifest.webmanifest',
  '/sw.js',
  '/favicon.ico',
];

function isPublicPath(pathname) {
  if (pathname === '/' || PUBLIC_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return true;
  }
  return false;
}

function isStaticAsset(pathname) {
  // Skip static files entirely
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    /\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|json|webmanifest|woff2?|ttf)$/.test(pathname)
  );
}

function hasAuthCookie(req) {
  // Heuristic: any Supabase auth cookie (covers both sb- and sb: naming)
  const all = req.cookies.getAll() || [];
  return all.some(c => c.name.startsWith('sb-') || c.name.startsWith('sb:') || c.name.includes('supabase'));
}

export function middleware(req) {
  const { pathname, search } = req.nextUrl;

  // Never run for static assets
  if (isStaticAsset(pathname)) return NextResponse.next();

  // Keep Stripe webhook totally untouched
  if (pathname.startsWith('/api/stripe/webhook')) return NextResponse.next();

  // Public routes
  if (isPublicPath(pathname)) {
    // If already authed and visiting auth pages, kick to dashboard
    if (pathname.startsWith('/auth') && hasAuthCookie(req)) {
      const url = req.nextUrl.clone();
      url.pathname = '/dashboard';
      url.search = '';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Protected areas
  const needsAuth =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/staff');

  if (needsAuth && !hasAuthCookie(req)) {
    const url = req.nextUrl.clone();
    url.pathname = '/auth/sign-in';
    // Preserve intended destination
    url.search = `?next=${encodeURIComponent(pathname + (search || ''))}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// Only match “app” routes, skip assets & webhooks to avoid 401s on manifest/sw.
export const config = {
  matcher: [
    '/((?!_next|static|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|css|js|map|txt|json|webmanifest|woff2?|ttf)|api/stripe/webhook).*)',
  ],
};

