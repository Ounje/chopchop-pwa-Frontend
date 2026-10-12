// CHOP CHOP Service Worker v2.0 - PWA Offline Play & Fast Asset Caching
const CACHE_NAME = 'chopchop-v2.0';

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/assets/jollof.webp',
  '/assets/chicken.webp',
  '/assets/plantain.webp',
  '/assets/amala.webp',
  '/assets/puffpuff.webp',
  '/assets/suya.webp',
  '/assets/moimoi.webp',
  '/assets/fish.webp',
  '/assets/meatpie.webp',
  '/assets/eba.webp',
  '/assets/friedrice.webp',
  '/assets/akara.webp',
  '/assets/whiterice.webp',
  '/assets/egusi.webp',
  '/assets/ogbono.webp',
  '/assets/ebans.webp',
  '/assets/chef.webp',
  '/assets/bomb.webp',
  '/assets/cutterh.webp',
  '/assets/cutterv.webp'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // Don't intercept API requests so live leaderboard data is always fresh
  if (req.url.includes('/api/') || req.url.includes('/functions/') || req.url.includes('/rest/')) {
    return;
  }

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(() => caches.match('/') as Promise<Response>)
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((cached) => {
      return (
        cached ||
        fetch(req).then((networkRes) => {
          if (networkRes.ok && new URL(req.url).origin === location.origin) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkRes;
        })
      );
    })
  );
});
