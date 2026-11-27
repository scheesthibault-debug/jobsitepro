/**
 * JobsitePro — QuickBooks sync (integrations-hub)
 */
(function (global) {
  'use strict';

  const api = () => global.ChantierTrackIntegrationsApi;

  function errRows(logs, L) {
    return (logs || [])
      .filter((l) => l.status === 'error')
      .slice(0, 8)
      .map(
        (l) =>
          `<tr><td style="font-size:11px">${l.entity_type || '–'}</td><td style="font-size:10px">${(l.local_id || '').slice(0, 10)}</td><td style="color:#f87171;font-size:11px">${l.message || '–'}</td></tr>`,
      )
      .join('');
  }

  function mappingRows(mappings) {
    return (mappings || [])
      .slice(0, 10)
      .map(
        (m) =>
          `<tr><td>${m.entity_type}</td><td style="font-size:10px">${m.local_id?.slice(0, 8)}…</td><td>${m.external_id || '–'}</td><td>${m.sync_status}</td></tr>`,
      )
      .join('');
  }

  async function renderPanel(ctx, hostId) {
    const host = document.getElementById(hostId || 'qb-sync-root');
    if (!host) return;
    const L = ctx.lang === 'fr';
    const c = ctx.co();
    host.innerHTML = `<div style="padding:12px;font-size:12px;color:var(--text3)">${L ? 'Chargement statut QuickBooks…' : 'Loading QuickBooks status…'}</div>`;

    let status = null;
    try {
      if (api()) status = await api().getStatus(c);
    } catch (e) {
      host.innerHTML = `<div style="padding:12px;font-size:12px;color:#fbbf24">${L ? 'Hub intégrations indisponible — démarrez services/integrations-hub (port 3101) et proxy /integrations/' : 'Integrations hub unavailable — start integrations-hub :3101'}<br><span style="font-size:11px;color:var(--text3)">${e.message || ''}</span></div>`;
      return;
    }

    const qb = status?.quickbooks || {};
    const connected = !!qb.connected;
    const lastLogs = qb.last_logs || [];
    const okCount = lastLogs.filter((l) => l.status === 'success').length;
    const errCount = lastLogs.filter((l) => l.status === 'error').length;

    host.innerHTML = `<div style="padding:4px 0">
      <div class="fin-kpi-row" style="margin-bottom:12px">
        <div class="fin-kpi"><div class="fin-kpi-lbl">${L ? 'Connexion' : 'Connection'}</div><div class="fin-kpi-val" style="color:${connected ? '#34d399' : '#f87171'}">${connected ? (L ? 'OK' : 'OK') : (L ? 'Non' : 'Off')}</div></div>
        <div class="fin-kpi"><div class="fin-kpi-lbl">Realm</div><div class="fin-kpi-val" style="font-size:12px">${qb.realm_id || '–'}</div></div>
        <div class="fin-kpi"><div class="fin-kpi-lbl">${L ? 'Environnement' : 'Environment'}</div><div class="fin-kpi-val" style="font-size:12px">${qb.environment || 'sandbox'}</div></div>
        <div class="fin-kpi"><div class="fin-kpi-lbl">${L ? 'Société QB' : 'QB company'}</div><div class="fin-kpi-val" style="font-size:11px">${qb.company_name || '–'}</div></div>
      </div>
      <p style="font-size:11px;color:var(--text3);margin-bottom:10px">${L ? 'Seules les dépenses approuvées et factures émises sont poussées. Pas de doublon grâce au mapping external_id.' : 'Only approved expenses and issued invoices are pushed. No duplicates via external_id mapping.'}</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        <button class="btn btn-p btn-sm" onclick="ChantierTrackQuickBooks.syncNow('push')" ${connected ? '' : 'disabled'}><i class="ti ti-upload"></i> ${L ? 'Sync manuelle → QB' : 'Manual sync → QB'}</button>
        <button class="btn btn-secondary btn-sm" onclick="ChantierTrackQuickBooks.syncNow('pull')" ${connected ? '' : 'disabled'}><i class="ti ti-download"></i> ${L ? 'Importer mes clients QuickBooks' : 'Import QuickBooks clients'}</button>
      </div>
      <p style="font-size:11px;color:var(--text3);margin:-4px 0 10px">${L ? 'L\u2019import récupère vos clients existants depuis QuickBooks vers JobsitePro (sans doublon).' : 'Import pulls your existing QuickBooks clients into JobsitePro (no duplicates).'}</p>
      <div class="fin-kpi-row" style="margin-bottom:10px">
        <div class="fin-kpi"><div class="fin-kpi-lbl">${L ? 'Succès récents' : 'Recent OK'}</div><div class="fin-kpi-val" style="color:#34d399">${okCount}</div></div>
        <div class="fin-kpi"><div class="fin-kpi-lbl">${L ? 'Erreurs' : 'Errors'}</div><div class="fin-kpi-val" style="color:${errCount ? '#f87171' : '#34d399'}">${errCount}</div></div>
      </div>
      ${(qb.mappings_preview || []).length ? `<p style="font-size:11px;font-weight:600;margin:8px 0 4px">${L ? 'Mapping (aperçu)' : 'Mapping preview'}</p>
      <table class="knowify-lines"><thead><tr><th>Type</th><th>Local</th><th>QB ID</th><th>Status</th></tr></thead><tbody>${mappingRows(qb.mappings_preview)}</tbody></table>` : ''}
      ${errCount ? `<p style="font-size:11px;font-weight:600;margin:12px 0 4px;color:#f87171">${L ? 'Dernières erreurs' : 'Latest errors'}</p>
      <table class="knowify-lines"><thead><tr><th>Type</th><th>Local</th><th>Message</th></tr></thead><tbody>${errRows(lastLogs, L)}</tbody></table>` : ''}
    </div>`;
  }

  async function syncNow(direction) {
    const ctx = global.getPatronModuleCtx?.();
    if (!ctx || !api()) return;
    const L = ctx.lang === 'fr';
    const entities = direction === 'pull'
      ? ['client']
      : ['client', 'expense', 'invoice', 'time_entry'];
    try {
      ctx.showToast(
        direction === 'pull'
          ? (L ? 'Import QuickBooks en cours…' : 'Importing from QuickBooks…')
          : (L ? 'Sync QuickBooks en cours…' : 'Syncing to QuickBooks…'),
        true,
      );
      const result = await api().runSync(ctx.co(), 'quickbooks', direction, entities);
      const ok = (result.results || []).filter((r) => r.ok && !r.skipped).length;
      const skipped = (result.results || []).filter((r) => r.skipped).length;
      const err = (result.results || []).filter((r) => r.error).length;
      ctx.showToast(
        direction === 'pull'
          ? (L ? `Import QB : ${ok} importés, ${skipped} déjà présents, ${err} erreurs` : `QB import: ${ok} imported, ${skipped} existing, ${err} errors`)
          : (L ? `Sync QB : ${ok} OK, ${skipped} ignorés, ${err} erreurs` : `QB sync: ${ok} OK, ${skipped} skipped, ${err} errors`),
        err === 0,
      );
      renderPanel(ctx, 'qb-sync-root');
    } catch (e) {
      ctx.showToast(e.message, false);
    }
  }

  global.ChantierTrackQuickBooks = { renderPanel, syncNow };
})(typeof window !== 'undefined' ? window : global);
