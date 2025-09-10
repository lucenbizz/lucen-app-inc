// app/layout.jsx
import './globals.css';
import React from 'react';
import ServiceWorkerRegister from './components/ServiceWorkerRegister';
import AuthSync from './components/AuthSync';

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://lucen-app-inc.vercel.app';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Lucen — Self Improvement, Ebooks & Scheduling',
  description: 'Premium self-improvement ebooks, flexible scheduling, and referral rewards.',
  manifest: '/manifest.webmanifest',
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
    description: 'Premium self-improvement ebooks, flexible scheduling, and referral rewards.',
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
        {/* Keep server cookies in sync with client auth state */}
        <AuthSync />
        {/* Register PWA service worker */}
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}

