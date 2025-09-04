import "./globals.css";
import React from "react";
import { ErrorProvider } from "./components/ErrorProvider";
import ConnectionBar from "./components/ConnectionBar";
import WireGlobalHandlers from "./components/WireGlobalHandlers";
import GlobalSpinner from "./components/GlobalSpinner";
import RefCapture from "./components/RefCapture";

// ---- Metadata (SEO/social) ----
export const metadata = {
  metadataBase: new URL("https://lucen.example.com"), // replace with your prod domain when ready
  title: "Lucen — Self Improvement, Ebooks & Scheduling",
  description:
    "Premium self-improvement ebooks, flexible scheduling, and referral rewards. Install the Lucen PWA for an app-like experience.",
  icons: {
    icon: [
      { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/apple-icon-180.png", sizes: "180x180", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon-180.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "Lucen",
    description:
      "Premium self-improvement ebooks, flexible scheduling, and referral rewards.",
    url: "https://lucen.example.com",
    siteName: "Lucen",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lucen",
    description: "Premium self-improvement ebooks & scheduling.",
    images: ["/og.png"],
  },
};

// ---- Viewport (move themeColor here to avoid warnings) ----
export const viewport = {
  themeColor: "#0a0a0a",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* PWA */}
        <link rel="manifest" href="/manifest.json" />
        {/* Duplicate theme-color is fine; Next also injects from viewport */}
        <meta name="theme-color" content="#0a0a0a" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>

      <body className="min-h-screen bg-[#0a0a0a] text-[#ededed]">
        {/* Accessibility */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 bg-black text-white px-3 py-2 rounded"
        >
          Skip to content
        </a>

        {/* Capture ?ref=... globally for referral discounts */}
        <RefCapture />

        {/* App-wide providers & global UI */}
        <ErrorProvider>
          <WireGlobalHandlers />
          <ConnectionBar />
          <GlobalSpinner />

          {/* Page content */}
          <div id="main" className="pt-3">
            {children}
          </div>
        </ErrorProvider>
      </body>
    </html>
  );
}
