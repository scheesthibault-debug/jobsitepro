/**
 * JobsitePro — Wagepoint (export CSV + API prête)
 */
(function (global) {
  'use strict';

  const api = () => global.ChantierTrackIntegrationsApi;

  async function renderPanel(ctx, hostId) {
    const host = document.getElementById(hostId || 'wp-sync-root');
    if (!host) return;
    const L = ctx.lang === 'fr';
    const c = ctx.co();
    host.innerHTML = `<div style="padding:12px;font-size:12px;color:var(--text3)">${L ? 'Chargement Wagepoint…' : 'Loading Wagepoint…'}</div>`;

    let status = null;
    try {
      if (api()) status = await api().getStatus(c);
    } catch (e) {
      host.innerHTML = `<div style="padding:12px;font-size:12px;color:#fbbf24">${L ? 'Hub intégrations indisponible' : 'Integrations hub unavailable'}<br>${e.message || ''}</div>`;
      return;
    }

    const wp = status?.wagepoint || {};
    const logs = wp.last_logs || [];

    host.innerHTML = `<div style="padding:4px 0">
      <p style="font-size:12px;color:var(--text2);margin-bottom:10px">${L ? 'Export des heures pointées (clock_out requis). Les heures non approuvées sont exclues quand le champ existe.' : 'Export clocked-out hours. Unapproved hours excluded when field exists.'}</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        <button class="btn btn-p btn-sm" onclick="ChantierTrackWagepoint.exportCsv()"><i class="ti ti-download"></i> ${L ? 'Exporter CSV Wagepoint' : 'Export Wagepoint CSV'}</button>
        <button class="btn btn-sm" onclick="ChantierTrackWagepoint.syncNow('push')"><i class="ti ti-upload"></i> ${L ? 'API directe (bientôt)' : 'Direct API (soon)'}</button>
      </div>
      <div id="wp-hours-preview" style="font-size:11px;color:var(--text3)">${L ? 'Aperçu des heures après export.' : 'Hours preview after export.'}</div>
      ${logs.length ? `<table class="knowify-lines" style="margin-top:10px"><thead><tr><th>${L ? 'Date' : 'Date'}</th><th>${L ? 'Message' : 'Message'}</th><th>Status</th></tr></thead><tbody>
        ${logs.slice(0, 6).map((l) => `<tr><td style="font-size:10px">${(l.created || '').slice(0, 10)}</td><td style="font-size:11px">${l.message || '–'}</td><td>${l.status}</td></tr>`).join('')}
      </tbody></table>` : ''}
    </div>`;
  }

  async function exportCsv() {
    const ctx = global.getPatronModuleCtx?.();
    if (!ctx || !api()) return;
    const L = ctx.lang === 'fr';
    try {
      const result = await api().runSync(ctx.co(), 'wagepoint', 'push');
      if (result.csv) {
        api().downloadCsv(`wagepoint_heures_${new Date().toISOString().slice(0, 10)}.csv`, result.csv);
      }
      const preview = document.getElementById('wp-hours-preview');
      if (preview && result.preview?.length) {
        preview.innerHTML = `<strong>${result.meta?.row_count || 0}</strong> ${L ? 'lignes' : 'rows'} — <span style="color:var(--text3)">${L ? 'aperçu' : 'preview'}:</span><br>${result.preview
          .slice(0, 5)
          .map((r) => `${r.date} · ${r.employee_name} · ${r.regular_hours}h reg + ${r.overtime_hours}h sup · ${r.job_name}`)
          .join('<br>')}`;
      }
      ctx.showToast(L ? `Export ${result.meta?.row_count || 0} lignes` : `Exported ${result.meta?.row_count || 0} rows`, true);
    } catch (e) {
      ctx.showToast(e.message, false);
    }
  }

  async function syncNow(direction) {
    const ctx = global.getPatronModuleCtx?.();
    if (!ctx) return;
    const L = ctx.lang === 'fr';
    ctx.showToast(
      L
        ? 'API Wagepoint directe — TODO partenaire. Utilisez Export CSV.'
        : 'Wagepoint direct API — TODO partner. Use CSV export.',
      false,
    );
    renderPanel(ctx, 'wp-sync-root');
  }

  global.ChantierTrackWagepoint = { renderPanel, syncNow, exportCsv };
})(typeof window !== 'undefined' ? window : global);
