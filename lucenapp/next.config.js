/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';

const STRIPE_JS = 'https://js.stripe.com';
const STRIPE_CHECKOUT = 'https://checkout.stripe.com';
const STRIPE_BILLING = 'https://billing.stripe.com';

const cspParts = [
  "default-src 'self'",
  // Next inline hydration + Tailwind styles
  "style-src 'self' 'unsafe-inline'",
  // Dev only 'unsafe-eval' (React Refresh); drop in prod
  `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"} ${STRIPE_JS}`,
  "img-src 'self' blob: data: https://khzbliduummbypuxqnfn.supabase.co https://*.supabase.co",
  "font-src 'self' data:",
  `connect-src 'self' https://khzbliduummbypuxqnfn.supabase.co wss://khzbliduummbypuxqnfn.supabase.co https://*.supabase.co wss://*.supabase.co ${STRIPE_JS} ${STRIPE_CHECKOUT} ${STRIPE_BILLING}`,
  `frame-src 'self' ${STRIPE_CHECKOUT} ${STRIPE_BILLING}`,
  "worker-src 'self' blob:",
  "base-uri 'self'",
  // Allow posting to Stripe hosted pages (redirected Checkout/Portal flows)
  `form-action 'self' ${STRIPE_CHECKOUT} ${STRIPE_BILLING}`,
];
const csp = cspParts.join('; ');

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'khzbliduummbypuxqnfn.supabase.co', pathname: '/storage/v1/object/public/**' },
      // If wildcard isn't supported in your Next version, replace with specific hosts you actually load from.
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
      // Ensure correct type + no-stale caching for the PWA manifest
      {
        source: '/manifest.webmanifest',
        headers: [
          { key: 'Content-Type', value: 'application/manifest+json; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
        ],
      },
      // Service worker should not be aggressively cached
      {
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }],
      },
      // Long-cache static assets
      {
        source: '/:all*(svg|png|jpg|jpeg|gif|webp|ico|css|js)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

module.exports = nextConfig;

