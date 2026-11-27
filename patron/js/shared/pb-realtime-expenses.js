/**
 * JobsitePro patron — PocketBase realtime (nouvelles dépenses)
 */
(function (global) {
  'use strict';

  let pb = null;
  let unsub = null;
  let lastPending = -1;

  async function ensurePb() {
    if (pb) return pb;
    const mod = await import('https://cdn.jsdelivr.net/npm/pocketbase/dist/pocketbase.es.mjs');
    const PocketBase = mod.default;
    const url = global.API_URL || global.localStorage?.getItem('ct_api_url') || '';
    pb = new PocketBase(url);
    const token = global.authToken || global.localStorage?.getItem('ct_token');
    const user = global.currentUser || JSON.parse(global.localStorage?.getItem('ct_user') || 'null');
    if (token && user) pb.authStore.save(token, user);
    return pb;
  }

  async function start() {
    if (unsub) return;
    try {
      const client = await ensurePb();
      const c = global.currentUser?.company;
      if (!c) return;
      unsub = await client.collection('expenses').subscribe('*', (e) => {
        if (e.action === 'create' && e.record?.status === 'pending' && e.record?.company === c) {
          const msg = global.lang === 'fr'
            ? `Nouvelle dépense — ${(e.record.vendor || e.record.amount || '').toString()}`
            : `New expense — ${(e.record.vendor || e.record.amount || '').toString()}`;
          global.showToast?.(msg, true);
          if (global.currentPage === 'depenses') global.renderDepenses?.();
          global.updateBadges?.();
        }
      });
    } catch (err) {
      console.warn('pb realtime expenses', err);
    }
  }

  function stop() {
    if (unsub) {
      try { unsub(); } catch { /* */ }
      unsub = null;
    }
  }

  global.ChantierTrackPbRealtime = { start, stop };
})(typeof window !== 'undefined' ? window : global);
