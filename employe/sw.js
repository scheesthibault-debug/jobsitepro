// sw.js — Service Worker JobsitePro Employé
const CACHE = 'jobsitepro-employe-v110';

const ASSETS = [
  '/employe/manifest.json',
  '/employe/icon-192.png',
  '/employe/icon-512.png',
  '/employe/apple-touch-icon.png',
  '/employe/logo-banner.png',
  '/employe/css/app-skins.css',
  '/employe/css/dext-scan.css',
  '/employe/js/theme-skins.js',
  '/employe/js/pwa-update.js',
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@2.44.0/tabler-icons.min.css',
];

function isAppDocument(url) {
  const p = url.pathname;
  return p.endsWith('/employe/') || p.endsWith('/employe/index.html') || p.endsWith('/employe');
}

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {})));
});

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('push', e => {
  let data = { title: 'JobsitePro', body: '', url: '/employe/?tab=notifications' };
  try {
    if (e.data) data = { ...data, ...e.data.json() };
  } catch {
    try {
      if (e.data) data = { ...data, ...JSON.parse(e.data.text()) };
    } catch {}
  }
  e.waitUntil(
    self.registration.showNotification(data.title || 'JobsitePro', {
      body: data.body || '',
      icon: '/employe/icon-192.png',
      badge: '/employe/icon-192.png',
      tag: 'ct-push-employe',
      data: { url: data.url || '/employe/' },
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/employe/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      for (const c of clients) {
        if (c.url.includes('/employe') && 'focus' in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('/api/')) return;

  const url = new URL(e.request.url);
  const htmlDoc = e.request.mode === 'navigate' || isAppDocument(url);

  if (htmlDoc) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() =>
          caches.match(e.request).then(c => c || caches.match('/employe/index.html'))
        )
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match('/employe/icon-192.png'));
    })
  );
});
