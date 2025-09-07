// public/sw.js — minimal PWA SW (no offline caching/fallback)
self.addEventListener('install', (event) => {
  // Take control immediately on update
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Become the active SW for all clients right away
  event.waitUntil(self.clients.claim());
});

