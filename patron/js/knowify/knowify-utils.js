/**
 * JobsitePro — Utilitaires Knowify (activité, helpers CRM)
 */
(function (global) {
  'use strict';

  async function logActivity(ctx, { entityType, entityId, activity, message, metadata }) {
    if (!ctx?.co?.()) return;
    try {
      await ctx.api('POST', '/api/collections/activity_events/records', {
        company: ctx.co(),
        actor: ctx.uid?.() || null,
        entity_type: entityType,
        entity_id: String(entityId),
        activity,
        message,
        metadata: metadata || {},
      });
    } catch { /* collection may not exist yet */ }
  }

  async function loadClients(ctx) {
    const c = ctx.co();
    try {
      const res = await ctx.apiList('clients', `company="${c}"`, '', 'nom', 500);
      return (res.items || []).filter(x => x?.id);
    } catch { return []; }
  }

  async function loadSites(ctx) {
    const c = ctx.co();
    try {
      const res = await ctx.apiList('sites', `company="${c}"`, '', 'name', 300);
      return (res.items || []).filter(x => x?.id);
    } catch { return []; }
  }

  async function loadEmployees(ctx) {
    const c = ctx.co();
    try {
      const res = await ctx.apiList('users', `company="${c}"`, '', 'name', 200);
      return (res.items || []).filter(x => x?.id);
    } catch { return []; }
  }

  async function nextInvoiceNumber(ctx) {
    const c = ctx.co();
    let comp = {};
    try { comp = await ctx.api('GET', `/api/collections/companies/records/${c}`); } catch { /* */ }
    const prefix = comp.facture_prefix || comp.soumission_prefix || 'FAC';
    const year = new Date().getFullYear();
    let max = Number(comp.facture_next_num) || 1;
    try {
      const res = await ctx.apiList('factures', `company="${c}"`, '', '-created', 1);
      const last = res.items?.[0];
      if (last?.numero) {
        const m = String(last.numero).match(/(\d+)\s*$/);
        if (m) max = Math.max(max, parseInt(m[1], 10) + 1);
      }
    } catch { /* */ }
    return `${prefix}-${year}-${String(max).padStart(4, '0')}`;
  }

  function missingCollectionHtml(lang, name) {
    const L = lang === 'fr';
    return `<div class="fin-module fin-hero"><h2>${name}</h2><p style="color:#fbbf24">${L ? 'Importez les collections dans PocketBase : pocketbase/knowify_collections_import.json (Settings → Import collections)' : 'Import collections in PocketBase: pocketbase/knowify_collections_import.json'}</p></div>`;
  }

  function modalShell(title, body, footer) {
    return `<div class="modal-header"><span class="modal-title">${title}</span><button class="btn btn-sm" onclick="closeModal()"><i class="ti ti-x"></i></button></div>
      <div style="max-height:65vh;overflow-y:auto;padding:0 4px">${body}</div>
      <div class="modal-footer">${footer || `<button class="btn" onclick="closeModal()">OK</button>`}</div>`;
  }

  function badge(text, color) {
    return `<span style="font-size:11px;font-weight:600;color:${color};background:${color}22;padding:3px 8px;border-radius:6px">${text}</span>`;
  }

  global.ChantierTrackKnowify = {
    logActivity,
    loadClients,
    loadSites,
    loadEmployees,
    nextInvoiceNumber,
    missingCollectionHtml,
    modalShell,
    badge,
  };
})(typeof window !== 'undefined' ? window : global);
