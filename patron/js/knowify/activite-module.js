/**
 * JobsitePro — Fil d'activité unifié (Knowify)
 */
(function (global) {
  'use strict';

  const K = () => global.ChantierTrackKnowify;

  const ICONS = {
    client: 'ti-user', lead: 'ti-user-search', site: 'ti-building', soumission: 'ti-file-invoice',
    facture: 'ti-receipt', paiement: 'ti-cash', expense: 'ti-receipt-2', time_entry: 'ti-clock',
    daily_log: 'ti-notebook', ticket: 'ti-tool', contrat: 'ti-file-certificate',
  };
  const COLORS = {
    created: '#34d399', updated: '#378add', status_changed: '#f59e0b', assigned: '#a78bfa',
    approved: '#5a9e1e', paid: '#34d399', converted: '#378add', comment: '#64748b',
  };

  async function render(ctx) {
    const host = document.getElementById('activite-root');
    if (!host) return;
    const L = ctx.lang === 'fr';
    const c = ctx.co();
    let events = [];
    try {
      const res = await ctx.apiList('activity_events', `company="${c}"`, 'actor', '-created', 100);
      events = res.items || [];
    } catch {
      host.innerHTML = K().missingCollectionHtml(ctx.lang, L ? 'Activité' : 'Activity');
      return;
    }
    host.innerHTML = `<div class="fin-module">
      <div class="fin-hero"><h2>${L ? 'Fil d\'activité' : 'Activity feed'}</h2><p>${L ? 'Historique unifié — clients, factures, tickets, etc.' : 'Unified history across modules'}</p></div>
      <div class="card"><div class="card-body" style="padding:0">
        ${events.length ? events.map(ev => {
          const ic = ICONS[ev.entity_type] || 'ti-point';
          const col = COLORS[ev.activity] || '#64748b';
          const actor = ev.expand?.actor?.name || ev.expand?.actor?.email || '';
          return `<div class="act-item" style="padding:10px 14px">
            <div style="width:28px;height:28px;border-radius:8px;background:${col}22;color:${col};display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="ti ${ic}"></i></div>
            <div style="flex:1;min-width:0">
              <div style="font-size:12px">${ev.message || ev.entity_type}</div>
              <div style="font-size:10px;color:var(--text3);margin-top:2px">${actor ? actor + ' · ' : ''}${ctx.fmtDate(ev.created)} · ${ev.entity_type}</div>
            </div>
          </div>`;
        }).join('') : `<div style="padding:32px;text-align:center;color:#64748b">${L ? 'Aucune activité — créez un client ou une facture' : 'No activity yet'}</div>`}
      </div></div>
    </div>`;
  }

  global.ChantierTrackActivite = { render };
})(typeof window !== 'undefined' ? window : global);
