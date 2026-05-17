const CACHE = 'mink-v3';
const ASSETS = [
  './',
  './index.html',
  './css/tokens.css',
  './css/app.css',
  './js/db.js',
  './js/utils.js',
  './js/services.js',
  './js/taskrow.js',
  './js/capture.js',
  './js/views.js',
  './js/drag.js',
  './js/settings.js',
  './js/detail.js',
  './js/app.js',
  './manifest.json',
  './icon.svg',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first: always try fresh, fall back to cache only when offline.
// Prevents stale code from sticking around across deploys.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
