const cacheName = 'diari-kombutxa-v33';
const localFiles = ['./', './index.html', './styles.css', './app.js', './firebase-sync.js', './logo.png', './manifest.webmanifest'];
self.addEventListener('install', event => event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(localFiles)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== cacheName).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => { const url = new URL(event.request.url), freshFiles = event.request.mode === 'navigate' || url.pathname.endsWith('/styles.css') || url.pathname.endsWith('/app.js'); if (freshFiles) { event.respondWith(fetch(event.request).then(response => { const copy = response.clone(); caches.open(cacheName).then(cache => cache.put(event.request, copy)); return response; }).catch(() => caches.match(event.request))); return; } event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request))); });

