// Tusyen service worker - network-first so safety/UI updates do not stay stale.
const CACHE = 'tusyen-v2';
const STATIC = [
  '/index.html',
  '/styles.css',
  '/app.js',
  '/components/shared.jsx',
  '/components/quiz.jsx',
  '/components/student.jsx',
  '/components/teacher.jsx',
  '/components/parent.jsx',
  '/components/admin.jsx',
  '/manifest.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws/')) return;
  if (e.request.method !== 'GET') return;

  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok) {
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, clone));
      }
      return res;
    }).catch(() => {
      if (e.request.mode === 'navigate' || url.pathname === '/') {
        return caches.match('/index.html');
      }
      return caches.match(e.request);
    })
  );
});
