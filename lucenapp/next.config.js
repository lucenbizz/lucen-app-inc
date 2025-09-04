/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';

const cspParts = [
  "default-src 'self'",
  // Next inline hydration + Tailwind styles typically need 'unsafe-inline' (styles are fine)
  "style-src 'self' 'unsafe-inline'",
  // Dev only 'unsafe-eval' (React Refresh); drop in prod
  `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"}`,
  "img-src 'self' blob: data: https://khzbliduummbypuxqnfn.supabase.co https://*.supabase.co",
  "font-src 'self' data:",
  "connect-src 'self' https://khzbliduummbypuxqnfn.supabase.co wss://khzbliduummbypuxqnfn.supabase.co https://*.supabase.co wss://*.supabase.co",
  "frame-src 'self'",
  "worker-src 'self' blob:",
  "base-uri 'self'",
  "form-action 'self'"
];
const csp = cspParts.join('; ');

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'khzbliduummbypuxqnfn.supabase.co', pathname: '/storage/v1/object/public/**' },
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
          { key: 'Permissions-Policy', value: "camera=(), microphone=(), geolocation=()" },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          // Optional isolation hardening (enable if you don’t embed cross-origin iframes/workers)
          // { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          // { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        ],
      },
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }] },
      { source: '/:all*(svg|png|jpg|jpeg|gif|webp|ico|css|js)', headers: [
        { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
      ]},
      { source: '/offline.html', headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }] },
    ];
  },
};

module.exports = nextConfig;
