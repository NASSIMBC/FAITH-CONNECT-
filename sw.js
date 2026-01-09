const CACHE_NAME = 'faith-connect-v1';
const urlsToCache = [
  './',
  './index.html',
  './script.js',
  './manifest.json'
  // J'ai retiré les liens https:// (Tailwind, Supabase) qui causent l'erreur "Failed to fetch"
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache ouvert');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});
