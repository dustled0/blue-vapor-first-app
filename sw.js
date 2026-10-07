// Offline support for Honesty Store.
// App files (index.html, data.js, ...) are network-first so edits show up right away,
// with the cached copy used when offline. Fonts and the Excel library come from CDNs
// and are cache-first, since their URLs never change.
const CACHE = 'honesty-store-v2';
const APP_FILES = ['./', './index.html', './data.js', './catalog.js', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png'];

self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);

    if (url.origin === location.origin) {
        event.respondWith(
            fetch(req)
                .then(res => {
                    const copy = res.clone();
                    caches.open(CACHE).then(cache => cache.put(req, copy));
                    return res;
                })
                .catch(() => caches.match(req, { ignoreSearch: true }))
        );
        return;
    }

    event.respondWith(
        caches.match(req).then(hit => hit || fetch(req).then(res => {
            if (res.ok || res.type === 'opaque') {
                const copy = res.clone();
                caches.open(CACHE).then(cache => cache.put(req, copy));
            }
            return res;
        }))
    );
});
