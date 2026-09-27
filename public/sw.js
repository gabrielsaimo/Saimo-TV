/*
 * Service worker do site: guarda só a casca do app (HTML, JS, CSS, ícones),
 * para ele abrir na hora e poder ser instalado como app.
 *
 * Nada de vídeo, playlist, catálogo ou API: esses sempre vêm da rede — uma
 * lista de canais velha em cache seria pior que nenhuma.
 */
const CACHE = 'saimo-casca-v1';
const CASCA = ['/', '/index.html', '/manifest.webmanifest', '/favicon.png', '/icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CASCA)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Página: rede primeiro (versão nova assim que publicada), cache se offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((r) => { const copia = r.clone(); caches.open(CACHE).then((c) => c.put('/index.html', copia)); return r; })
        .catch(() => caches.match('/index.html')),
    );
    return;
  }

  // JS/CSS/ícones com hash no nome: o que estiver em cache vale.
  if (/\/assets\/|\/icons\/|\.(?:js|css|png|svg|woff2?)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then((achado) => achado || fetch(req).then((r) => {
        if (r.ok) { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(req, copia)); }
        return r;
      })),
    );
  }
});
