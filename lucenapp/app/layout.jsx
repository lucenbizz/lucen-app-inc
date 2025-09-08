// app/layout.jsx
import "./globals.css";

export const metadata = {
  metadataBase: new URL("https://lucen-app-inc.vercel.app"),
  title: "Lucen — Self Improvement, Ebooks & Scheduling",
  description:
    "Premium self-improvement ebooks, flexible scheduling, and referral rewards.",
  icons: {
    icon: [
      { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-180.png", sizes: "180x180", type: "image/png" },
    ],
    apple: [{ url: "/icon-180.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "Lucen",
    description:
      "Premium self-improvement ebooks, flexible scheduling, and referral rewards.",
    url: "https://lucen-app-inc.vercel.app",
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

export const viewport = {
  themeColor: "#0a0a0a",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#0a0a0a" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="min-h-screen bg-[#0a0a0a] text-[#ededed]">
        {children}
      </body>
    </html>
  );
}
