/* silent, minimal PWA service worker */
self.addEventListener('install', (e) => {
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  clients.claim();
});
/* Optional: add fetch caching later—keep it silent for now */
