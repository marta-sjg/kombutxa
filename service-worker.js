const cacheName = 'diari-kombutxa-v1';
const localFiles = ['./', './index.html', './styles.css', './app.js', './logo.png', './manifest.webmanifest'];
self.addEventListener('install', event => event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(localFiles))));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request))));
