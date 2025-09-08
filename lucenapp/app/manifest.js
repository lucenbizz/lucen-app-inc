// app/manifest.js
export default function manifest() {
  return {
    name: "Lucen",
    short_name: "Lucen",
    description: "Premium self-improvement ebooks, flexible scheduling, and referral rewards.",
    id: "/",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ],
    // optional, helps some platforms
    display_override: ["standalone", "window-controls-overlay"]
  };
}
