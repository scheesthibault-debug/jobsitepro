/**
 * JobsitePro — bandeau « Mise à jour disponible » (PWA)
 * data-sw-url="sw.js?v=88"  data-app="patron|employe"
 */
(function () {
  'use strict';

  const script = document.currentScript;
  const SW_URL = script?.dataset?.swUrl || 'sw.js';
  const APP = script?.dataset?.app || 'patron';
  const CHECK_MS = 45 * 60 * 1000;

  function msg() {
    const lang = localStorage.getItem('ct_lang') || 'fr';
    if (lang === 'en') {
      return {
        text: 'A new version of JobsitePro is available.',
        btn: 'Reload',
      };
    }
    return {
      text: 'Une nouvelle version de JobsitePro est disponible.',
      btn: 'Recharger',
    };
  }

  function injectStyles() {
    if (document.getElementById('pwa-update-styles')) return;
    const bottom = APP === 'employe' ? 'calc(68px + env(safe-area-inset-bottom, 0px))' : '0';
    const el = document.createElement('style');
    el.id = 'pwa-update-styles';
    el.textContent = `
#pwa-update-banner{
  position:fixed;left:0;right:0;bottom:${bottom};z-index:10000;
  display:flex;align-items:center;gap:10px;flex-wrap:wrap;
  padding:12px 14px;padding-bottom:max(12px,env(safe-area-inset-bottom,0px));
  background:var(--bg2,#1f1f23);color:var(--text,#e4e4e7);
  border-top:0.5px solid var(--border2,rgba(255,255,255,.14));
  box-shadow:0 -8px 28px rgba(0,0,0,.4);
  font-size:13px;line-height:1.35;
  animation:pwa-update-in .25s ease;
}
@keyframes pwa-update-in{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}
#pwa-update-banner .pwa-update-text{flex:1;min-width:140px}
#pwa-update-banner .pwa-update-btn{
  flex-shrink:0;padding:8px 14px;border-radius:8px;border:none;
  background:var(--orange,#EA8C2A);color:#fff;font-size:13px;font-weight:600;cursor:pointer;
}
#pwa-update-banner .pwa-update-btn:active{opacity:.9}
`;
    document.head.appendChild(el);
  }

  function showBanner(reg) {
    if (document.getElementById('pwa-update-banner')) return;
    injectStyles();
    const m = msg();
    const bar = document.createElement('div');
    bar.id = 'pwa-update-banner';
    bar.setAttribute('role', 'alert');
    bar.innerHTML = `<span class="pwa-update-text">${m.text}</span><button type="button" class="pwa-update-btn">${m.btn}</button>`;
    bar.querySelector('.pwa-update-btn').addEventListener('click', () => {
      const w = reg?.waiting || registration?.waiting;
      if (w) w.postMessage({ type: 'SKIP_WAITING' });
    });
    document.body.appendChild(bar);
  }

  let registration = null;
  let refreshing = false;

  function onWaiting(reg) {
    if (reg.waiting && navigator.serviceWorker.controller) showBanner(reg);
  }

  function trackInstalling(reg) {
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      if (!nw) return;
      nw.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) {
          showBanner(reg);
        }
      });
    });
  }

  function initRegistration(reg) {
    registration = reg;
    onWaiting(reg);
    trackInstalling(reg);
    reg.update().catch(() => {});
    setInterval(() => reg.update().catch(() => {}), CHECK_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  }

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  function start() {
    navigator.serviceWorker.register(SW_URL)
      .then(initRegistration)
      .catch(() => {});
  }

  if (document.readyState === 'loading') {
    window.addEventListener('load', start);
  } else {
    start();
  }
})();
