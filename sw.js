// TRACK-BACK Service Worker - untuk fungsi offline
const CACHE_NAME = 'trackback-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-apple.png',
  'https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=IBM+Plex+Mono:wght@300;400;500;600&family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// Install: cache assets utama
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // Cache assets satu per satu (lebih toleran terhadap error)
        return Promise.allSettled(
          ASSETS.map(url => cache.add(url).catch(err => console.log('Cache miss:', url)))
        );
      })
      .then(() => self.skipWaiting())
  );
});

// Activate: bersihkan cache lama
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names => {
      return Promise.all(
        names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: cache-first untuk asset, network-first untuk peta tile
self.addEventListener('fetch', event => {
  const url = event.request.url;
  
  // Tile peta: network-first (perlu data terbaru)
  if (url.includes('basemaps.cartocdn.com') || url.includes('tile.openstreetmap')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }
  
  // Asset lain: cache-first
  event.respondWith(
    caches.match(event.request)
      .then(cached => cached || fetch(event.request).then(response => {
        // Cache response baru
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }))
      .catch(() => {
        // Fallback offline
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      })
  );
});
