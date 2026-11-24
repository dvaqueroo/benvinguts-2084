// Service worker: primer la xarxa (sempre la darrera versió publicada) i, si no hi ha
// connexió, la còpia en memòria cau. No cal pujar VERSION a cada canvi.
const VERSION = 'b2084-net-1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './img/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const old = (await caches.keys()).filter((k) => k !== VERSION);
    await Promise.all(old.map((k) => caches.delete(k)));
    await self.clients.claim();
    // Si venim d'un service worker antic (cache-first), recarrega les pestanyes obertes.
    if (old.length) {
      for (const c of await self.clients.matchAll({ type: 'window' })) c.navigate(c.url);
    }
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname.endsWith('/version.txt')) return;
  if (req.headers.has('range')) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && res.status === 200) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))),
  );
});
