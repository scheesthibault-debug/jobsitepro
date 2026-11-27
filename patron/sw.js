// sw.js — Service Worker JobsitePro Patron
const CACHE = 'jobsitepro-patron-v120';
const ASSETS = [
  '/patron/manifest.json',
  '/patron/css/app-skins.css',
  '/patron/css/modules-finance.css',
  '/patron/js/theme-skins.js',
  '/patron/js/pwa-update.js',
  '/patron/js/soumissions/canada-sales-tax.js',
  '/patron/js/soumissions/soumissions-editor.js',
  '/patron/js/soumissions/soumissions-page.js',
  '/patron/js/depenses/dext-expenses-ui.js',
  '/patron/js/job-costing/site-cost-dashboard.js',
  '/patron/js/knowify/knowify-utils.js',
  '/patron/js/knowify/clients-module.js',
  '/patron/js/nav-sections.js',
  '/patron/js/knowify/quickbooks-module.js',
  '/patron/js/integrations/wagepoint-module.js',
  '/patron/js/integrations/connectors-panel.js',
  '/patron/icon-192.png',
  '/patron/icon-512.png',
  '/patron/apple-touch-icon.png',
  '/patron/js/pdf-reports.js',
  '/patron/js/excel-export.js',
  '/patron/templates/excel/pointages.xlsx',
  '/patron/templates/excel/depenses.xlsx',
  '/patron/templates/excel/kilometrage.xlsx',
  '/patron/logo-banner.png',
];

function isAppDocument(url) {
  const p = url.pathname;
  return url.pathname.endsWith('/patron/') || p.endsWith('/patron/index.html') || p.endsWith('/patron');
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
  let data = { title: 'JobsitePro', body: '', url: '/patron/?page=conges' };
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
      icon: '/patron/icon-192.png',
      badge: '/patron/icon-192.png',
      tag: 'ct-push-patron',
      data: { url: data.url || '/patron/' },
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/patron/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      for (const c of clients) {
        if (c.url.includes('/patron') && 'focus' in c) {
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
          caches.match(e.request).then(c => c || caches.match('/patron/index.html'))
        )
    );
    return;
  }

  const reqUrl = e.request.url;
  if (reqUrl.includes('auth-rbac.js') || reqUrl.includes('rbac-guards.js')) {
    e.respondWith(fetch(e.request, { cache: 'no-store' }).catch(() => caches.match(e.request)));
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
      }).catch(() => caches.match('/patron/icon-192.png'));
    })
  );
});
