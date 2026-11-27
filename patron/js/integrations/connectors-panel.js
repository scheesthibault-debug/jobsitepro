/**
 * Connecteurs OAuth QuickBooks + Wagepoint (pages dédiées menu latéral)
 */
(function (global) {
  'use strict';

  const DEFAULT = {
    quickbooks: { connected: false, email: '', connected_at: '' },
    wagepoint: { connected: false, email: '', connected_at: '' },
  };

  const META = {
    quickbooks: {
      title: 'QuickBooks',
      icon: '<i class="ti ti-brand-quickbooks" style="font-size:22px;color:#2ca01c"></i>',
      descFr: 'Factures clients, dépenses, comptes',
      descEn: 'Invoices, expenses, chart of accounts',
    },
    wagepoint: {
      title: 'Wagepoint',
      icon: '<i class="ti ti-cash" style="font-size:22px;color:#378add"></i>',
      descFr: 'Paie — heures et employés',
      descEn: 'Payroll — hours and employees',
    },
  };

  function mergeConfig(raw) {
    let cfg = { ...DEFAULT };
    if (!raw) return cfg;
    try {
      const p = typeof raw === 'string' ? JSON.parse(raw) : raw;
      cfg = {
        quickbooks: { ...DEFAULT.quickbooks, ...(p.quickbooks || {}) },
        wagepoint: { ...DEFAULT.wagepoint, ...(p.wagepoint || {}) },
      };
    } catch { /* ignore */ }
    return cfg;
  }

  async function loadConfig(ctx) {
    try {
      const co = await ctx.api('GET', `/api/collections/companies/records/${ctx.co()}`);
      return mergeConfig(co.integrations_config);
    } catch {
      return mergeConfig(null);
    }
  }

  async function saveConfig(ctx, cfg) {
    await ctx.api('PATCH', `/api/collections/companies/records/${ctx.co()}`, {
      integrations_config: cfg,
    });
  }

  function connectorCard(opts) {
    const { id, title, icon, desc, connected, email, connectLabel, disconnectLabel } = opts;
    const statusColor = connected ? '#34d399' : '#94a3b8';
    const statusText = connected ? opts.connectedLabel : opts.notConnectedLabel;
    return `<div class="connector-card" id="connector-${id}">
      <div class="connector-head">
        <div class="connector-icon">${icon}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:14px">${title}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px">${desc}</div>
        </div>
        <span class="connector-status" style="color:${statusColor}">${statusText}</span>
      </div>
      ${connected && email ? `<p style="font-size:12px;color:var(--text2);margin:8px 0 0"><i class="ti ti-mail" style="font-size:12px"></i> ${email}</p>` : ''}
      <div class="connector-actions">
        ${connected
          ? `<button type="button" class="btn btn-d btn-sm" onclick="ChantierTrackConnectors.disconnect('${id}')">${disconnectLabel}</button>`
          : `<button type="button" class="btn btn-p btn-sm" onclick="ChantierTrackConnectors.connect('${id}')">${connectLabel}</button>`}
      </div>
    </div>`;
  }

  function refreshAfterChange(provider) {
    const pg = document.querySelector('.page.active')?.id?.replace('page-', '');
    if (pg === provider && typeof global.renderPage === 'function') global.renderPage(provider);
    else if (pg === provider) {
      if (provider === 'quickbooks' && typeof global.renderQuickbooks === 'function') global.renderQuickbooks();
      if (provider === 'wagepoint' && typeof global.renderWagepoint === 'function') global.renderWagepoint();
    }
  }

  async function renderSingle(hostId, provider) {
    const ctx = global.getPatronModuleCtx?.();
    const host = document.getElementById(hostId);
    if (!host || !ctx || !META[provider]) return;
    const L = ctx.lang === 'fr';
    const cfg = await loadConfig(ctx);
    const m = META[provider];
    const block = cfg[provider];
    host.innerHTML = connectorCard({
      id: provider,
      title: m.title,
      icon: m.icon,
      desc: L ? m.descFr : m.descEn,
      connected: !!block.connected,
      email: block.email || '',
      connectLabel: L ? `Connecter ${m.title}` : `Connect ${m.title}`,
      disconnectLabel: L ? 'Déconnecter' : 'Disconnect',
      connectedLabel: L ? 'Connecté' : 'Connected',
      notConnectedLabel: L ? 'Non connecté' : 'Not connected',
    });
  }

  async function connect(provider) {
    const ctx = global.getPatronModuleCtx?.();
    if (!ctx) return;
    const base = (global.API_URL || window.location.origin).replace(/\/$/, '');
    const company = ctx.co();
    if (provider === 'quickbooks') {
      window.location.href = `${base}/api/jobsitepro/oauth/quickbooks/start?company=${encodeURIComponent(company)}`;
      return;
    }
    if (provider === 'wagepoint') {
      window.location.href = `${base}/api/jobsitepro/oauth/wagepoint/start?company=${encodeURIComponent(company)}`;
    }
  }

  async function disconnect(provider) {
    const ctx = global.getPatronModuleCtx?.();
    if (!ctx) return;
    const L = ctx.lang === 'fr';
    const cfg = await loadConfig(ctx);
    if (provider === 'quickbooks') cfg.quickbooks = { ...DEFAULT.quickbooks };
    if (provider === 'wagepoint') cfg.wagepoint = { ...DEFAULT.wagepoint };
    try {
      await saveConfig(ctx, cfg);
      ctx.showToast(L ? 'Déconnecté' : 'Disconnected', true);
      refreshAfterChange(provider);
    } catch (e) {
      ctx.showToast(e.message, false);
    }
  }

  function handleOAuthReturn() {
    const params = new URLSearchParams(window.location.search);
    const oauth = params.get('oauth');
    const status = params.get('status');
    if (!oauth) return null;
    const ctx = global.getPatronModuleCtx?.();
    const L = ctx?.lang === 'fr';
    if (status === 'ok' && ctx) {
      ctx.showToast(
        oauth === 'wagepoint'
          ? L
            ? 'Wagepoint connecté'
            : 'Wagepoint connected'
          : L
            ? 'QuickBooks connecté'
            : 'QuickBooks connected',
        true
      );
    } else if (ctx) {
      ctx.showToast(params.get('error') || (L ? 'Connexion annulée' : 'Connection cancelled'), false);
    }
    params.delete('oauth');
    params.delete('status');
    params.delete('error');
    const q = params.toString();
    const clean = window.location.pathname + (q ? `?${q}` : '') + window.location.hash;
    window.history.replaceState({}, '', clean);
    return oauth === 'wagepoint' || oauth === 'quickbooks' ? oauth : null;
  }

  global.ChantierTrackConnectors = { renderSingle, connect, disconnect, handleOAuthReturn };
})(typeof window !== 'undefined' ? window : global);
