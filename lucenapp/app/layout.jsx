// app/layout.jsx
import './globals.css';
import React from 'react';

import { ErrorProvider } from '../components/ErrorProvider';
import ConnectionBar from '../components/ConnectionBar';
import WireGlobalHandlers from '../components/WireGlobalHandlers';
import GlobalSpinner from '../components/GlobalSpinner';
import ServiceWorkerRegister from '../components/ServiceWorkerRegister';

// ----- Metadata & Viewport -----
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://lucen-app-inc.vercel.app';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Lucen — Self Improvement, Ebooks & Scheduling',
  description:
    'Premium self-improvement ebooks, flexible scheduling, and referral rewards.',
  icons: {
    icon: [
      { url: '/icon-32.png', sizes: '32x32' },
      { url: '/icon-192.png', sizes: '192x192' },
      { url: '/icon-180.png', sizes: '180x180' },
    ],
    apple: [{ url: '/icon-180.png', sizes: '180x180' }],
  },
  openGraph: {
    title: 'Lucen',
    description:
      'Premium self-improvement ebooks, flexible scheduling, and referral rewards.',
    url: SITE_URL,
    siteName: 'Lucen',
    images: [{ url: '/og.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lucen',
    description: 'Premium self-improvement ebooks & scheduling.',
    images: ['/og.png'],
  },
};

export const viewport = {
  themeColor: '#0a0a0a',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0a0a0a] text-[#ededed]">
        {/* Accessibility skip link */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 bg-black text-white px-3 py-2 rounded"
        >
          Skip to content
        </a>

        {/* Global app scaffolding */}
        <ErrorProvider>
          <WireGlobalHandlers />
          <ConnectionBar />
          <GlobalSpinner />

          {/* Register PWA service worker (client component) */}
          <ServiceWorkerRegister />

          {/* Page content */}
          <div id="main" className="pt-3">
            {children}
          </div>
        </ErrorProvider>
      </body>
    </html>
  );
}
