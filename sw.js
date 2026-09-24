/* Ember service worker — offline cache for the app shell (only active when served over http/https) */
const CACHE = 'ember-v4';
const SHELL = [
  './', './index.html', './css/app.css', './manifest.webmanifest',
  './assets/icon.svg', './assets/apple-touch-icon.png', './assets/icon-192.png', './assets/icon-512.png',
  './js/core.js', './js/store.js', './js/ui.js', './js/focus-engine.js', './js/spotlight.js', './js/app.js',
  './js/views/today.js', './js/views/journal.js', './js/views/habits.js', './js/views/goals.js', './js/views/books.js',
  './js/views/tasks.js', './js/views/focus.js', './js/views/insights.js', './js/views/settings.js', './js/views/health.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

// Network first for our own files (so updates show up), falling back to cache when offline.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
