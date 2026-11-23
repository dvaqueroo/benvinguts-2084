// Service worker: precache del shell + caché en tiempo de ejecución (cache-first)
// para fuentes, orbes, hologramas y bundles con hash. Funciona offline tras la 1ª carga.
const VERSION = 'b2084-v17'; // v3: holograma i orbes en WebGL (three.js local)
const SHELL = ['./', './index.html', './manifest.webmanifest', './img/icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // Los vídeos usan peticiones Range: se sirven de red y no se cachean aquí.
  if (req.headers.has('range')) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok && res.status === 200) {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy));
      }
      return res;
    })),
  );
});
