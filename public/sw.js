const CACHE = 'daily-journal-v2';
const OFFLINE_URL = '/offline';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([OFFLINE_URL, '/manifest.json'])));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Intercept ONLY page navigations: network first, offline page as fallback.
// Static assets, Next.js chunks and API calls go straight to the network —
// intercepting them served/failed stale hashed chunks after each deploy
// (rejected fetch → "Application error" white screen).
self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(
    fetch(e.request).catch(() =>
      caches.match(OFFLINE_URL).then(
        (r) => r || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
      )
    )
  );
});
