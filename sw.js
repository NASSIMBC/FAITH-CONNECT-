const CACHE_NAME = 'faith-connect-v4'; // J'ai changé la version pour forcer la mise à jour
const urlsToCache = [
  './',
  './index.html',
  './script.js',
  './manifest.json'
];

self.addEventListener('install', event => {
  self.skipWaiting(); // Force l'activation immédiate
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName); // Supprime les vieux caches
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', event => {
  // IMPORTANT : Si la requête va vers un autre site (Bible, Supabase...), on laisse faire le réseau
  if (!event.request.url.startsWith(self.location.origin)) {
    return; 
  }

  // Sinon (fichiers locaux), on utilise le cache
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
