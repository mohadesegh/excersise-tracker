/// <reference lib="webworker" />
/**
 * Offline support with zero dependencies.
 *  - App shell is precached on install.
 *  - Page navigations: network first, cached shell as fallback (works offline).
 *  - Same-origin assets & Google Fonts: cache first, filled on first use.
 */
export {};
declare const self: ServiceWorkerGlobalScope;

const VERSION = 'v3';
const SHELL = `varzideh-shell-${VERSION}`;
const RUNTIME = `varzideh-rt-${VERSION}`;
const PRECACHE = ['/', '/index.html', '/manifest.webmanifest', '/manifest.en.webmanifest', '/manifest.tr.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![SHELL, RUNTIME].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put('/index.html', copy));
          return res;
        })
        .catch(async () => (await caches.match('/index.html')) ?? Response.error()),
    );
    return;
  }

  // app files, fonts, and the on-device pose model (so the camera check works offline after first use)
  const cacheable =
    url.origin === location.origin ||
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com' ||
    (url.hostname === 'cdn.jsdelivr.net' && url.pathname.startsWith('/npm/@mediapipe/')) ||
    (url.hostname === 'storage.googleapis.com' && url.pathname.startsWith('/mediapipe-models/'));
  if (!cacheable) return;

  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ??
        fetch(req).then((res) => {
          if (res.ok || res.type === 'opaque') {
            const copy = res.clone();
            caches.open(RUNTIME).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
