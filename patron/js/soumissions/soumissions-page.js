/**
 * JobsitePro — Soumissions & estimés (inbox Knowify — documents)
 */
(function (global) {
  'use strict';

  const Tax = () => global.ChantierTrackCanadaTax;
  let selectedId = null;
  let cachedList = [];

  function calcTotals(phases, province) {
    if (Tax()) return Tax().calcFromPhases(phases, province);
    return { montant_ht: 0, montant_tps: 0, montant_tvq: 0, montant_ttc: 0 };
  }

  const STATUT_LABELS = {
    fr: { brouillon: 'Brouillon', envoye: 'Envoyé', accepte: 'Accepté', refuse: 'Refusé', expire: 'Expiré' },
    en: { brouillon: 'Draft', envoye: 'Sent', accepte: 'Accepted', refuse: 'Declined', expire: 'Expired' },
  };
  const STAT_COL = { brouillon: '#64748b', envoye: '#f59e0b', accepte: '#34d399', refuse: '#f87171', expire: '#94a3b8' };

  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function statutPill(st, lang) {
    const lbl = (STATUT_LABELS[lang] || STATUT_LABELS.fr)[st] || st;
    const c = STAT_COL[st] || '#64748b';
    return `<span class="dext-pill" style="color:${c};background:${c}22">${escapeHtml(lbl)}</span>`;
  }

  function phasePreview(s, L) {
    const phases = Array.isArray(s.phases) ? s.phases : [];
    if (!phases.length) {
      return `<div class="knw-list-empty" style="padding:16px"><span>${L ? 'Aucune phase — ouvrez pour éditer' : 'No phases — open to edit'}</span></div>`;
    }
    return phases.slice(0, 8).map((ph, i) => {
      const lines = Array.isArray(ph.lignes) ? ph.lignes : (Array.isArray(ph.lines) ? ph.lines : []);
      const sub = lines.reduce((a, ln) => a + (Number(ln.quantite) || 0) * (Number(ln.prix_unitaire) || Number(ln.prix) || 0), 0);
      const title = ph.nom || ph.name || `${L ? 'Phase' : 'Phase'} ${i + 1}`;
      return `<div class="knw-line-mini"><span>${escapeHtml(title)} <span style="color:#64748b">(${lines.length} ${L ? 'lignes' : 'lines'})</span></span><span>${sub ? sub.toFixed(2) + ' $' : '–'}</span></div>`;
    }).join('') + (phases.length > 8 ? `<div style="font-size:11px;color:#64748b;padding-top:6px">+${phases.length - 8}…</div>` : '');
  }

  function renderList(ctx, list) {
    const { lang, fmtMoney, fmtDate } = ctx;
    const L = lang === 'fr';
    if (!list.length) {
      return `<div class="knw-list-empty"><i class="ti ti-file-description"></i><strong>${L ? 'Aucune soumission' : 'No quotes'}</strong><span>${L ? 'Créez la première — elle apparaîtra comme un document.' : 'Create your first quote document.'}</span></div>`;
    }
    return list.map(s => {
      const active = selectedId === s.id ? ' active' : '';
      const st = s.statut || 'brouillon';
      const title = s.expand?.site?.name || s.titre || s.numero || (L ? 'Soumission' : 'Quote');
      return `<button type="button" class="knw-row${active}" data-id="${s.id}" onclick="ChantierTrackSoumissions.select('${s.id}')">
        <div class="knw-avatar knw-avatar--doc"><i class="ti ti-file-text"></i></div>
        <div class="knw-row-main">
          <div class="knw-row-top">
            <span class="knw-row-title">${escapeHtml(title)}</span>
            <span class="knw-row-amt">${fmtMoney(s.montant_ttc)}</span>
          </div>
          <div class="knw-row-meta">
            ${statutPill(st, lang)}
            <span>${escapeHtml(s.client_nom || '–')}</span>
            <span>·</span>
            <span>${escapeHtml(s.numero || '')}</span>
            <span>·</span>
            <span>${fmtDate(s.created)}</span>
          </div>
        </div>
      </button>`;
    }).join('');
  }

  function renderDetail(ctx, s) {
    const { lang, fmtMoney, fmtDate } = ctx;
    const L = lang === 'fr';
    if (!s) {
      return `<div class="knw-detail-empty"><i class="ti ti-file-search"></i><strong>${L ? 'Sélectionnez une soumission' : 'Select a quote'}</strong><span>${L ? 'Aperçu du document à droite — comme un devis Knowify.' : 'Document preview on the right.'}</span></div>`;
    }
    const st = s.statut || 'brouillon';
    const title = s.expand?.site?.name || s.titre || (L ? 'Soumission' : 'Quote');
    return `
      <div class="knw-doc-banner">
        <div class="knw-doc-banner-icon"><i class="ti ti-file-text"></i></div>
        <div class="knw-doc-banner-body">
          <h3>${escapeHtml(title)}</h3>
          <p>${statutPill(st, lang)} · ${escapeHtml(s.numero || '–')} · ${escapeHtml(s.province || '')}</p>
        </div>
        <div class="knw-doc-banner-amt">${fmtMoney(s.montant_ttc)}</div>
      </div>
      <div class="knw-detail-body">
        <div class="knw-detail-grid">
          <div class="knw-detail-row"><span>Client</span><span>${escapeHtml(s.client_nom || '–')}</span></div>
          <div class="knw-detail-row"><span>${L ? 'Chantier' : 'Site'}</span><span>${escapeHtml(s.expand?.site?.name || '–')}</span></div>
          <div class="knw-detail-row"><span>${L ? 'Créé' : 'Created'}</span><span>${fmtDate(s.created)}</span></div>
          <div class="knw-detail-row"><span>${L ? 'Sous-total HT' : 'Subtotal'}</span><span>${fmtMoney(s.montant_ht)}</span></div>
          <div class="knw-detail-row"><span>TPS/TVQ</span><span>${fmtMoney((s.montant_tps || 0) + (s.montant_tvq || 0))}</span></div>
          <div class="knw-detail-row"><span>Total TTC</span><span style="color:#f59e0b;font-weight:700">${fmtMoney(s.montant_ttc)}</span></div>
        </div>
        <div class="knw-detail-section">
          <h4>${L ? 'Phases du devis' : 'Quote phases'}</h4>
          ${phasePreview(s, L)}
        </div>
      </div>
      <div class="knw-detail-actions">
        <button type="button" class="btn btn-p btn-sm" onclick="ChantierTrackSoumissions.openEdit('${s.id}')"><i class="ti ti-edit"></i> ${L ? 'Ouvrir / modifier' : 'Open / edit'}</button>
      </div>`;
  }

  async function renderSoumissions(ctx) {
    const { apiList, co, lang, fmtMoney } = ctx;
    const host = document.getElementById('soumissions-root');
    if (!host) return;
    const c = co();
    const L = lang === 'fr';

    let list = [];
    try {
      const res = await apiList('soumissions', `company="${c}"`, 'site,created_by', '-created', 100);
      list = res.items || [];
    } catch {
      host.innerHTML = `<div class="fin-module fin-hero"><h2>${L ? 'Soumissions' : 'Quotes'}</h2><p style="color:#fbbf24">${L ? 'Créez la collection « soumissions » dans PocketBase (voir pocketbase/soumissions_collection.json)' : 'Create soumissions collection in PocketBase'}</p></div>`;
      return;
    }

    cachedList = list;
    if (!selectedId && list.length) selectedId = list[0].id;
    if (selectedId && !list.find(x => x.id === selectedId)) selectedId = list[0]?.id || null;
    const sel = list.find(x => x.id === selectedId);

    const pending = list.filter(s => s.statut === 'envoye').length;
    const accepted = list.filter(s => s.statut === 'accepte').length;
    const totalOpen = list.filter(s => ['brouillon', 'envoye'].includes(s.statut)).reduce((a, s) => a + (s.montant_ttc || 0), 0);
    const rate = list.length ? Math.round((accepted / list.length) * 100) : 0;

    host.innerHTML = `<div class="fin-module">
      <div class="fin-hero knw-hero">
        <div>
          <h2>${L ? 'Soumissions & estimés' : 'Quotes & estimates'}</h2>
          <p>${L ? 'Documents de devis — miniature à gauche, aperçu des phases et totaux à droite.' : 'Quote documents — list on the left, phase preview on the right.'}</p>
        </div>
        <div class="knw-hero-actions">
          <button class="btn btn-p" onclick="ChantierTrackSoumissions.openCreate()"><i class="ti ti-plus"></i> ${L ? 'Nouvelle soumission' : 'New quote'}</button>
        </div>
      </div>
      <div class="fin-kpi-row">
        <div class="fin-kpi"><div class="fin-kpi-lbl">${L ? 'Pipeline ouvert' : 'Open pipeline'}</div><div class="fin-kpi-val accent">${fmtMoney(totalOpen)}</div></div>
        <div class="fin-kpi"><div class="fin-kpi-lbl">${L ? 'En attente client' : 'Awaiting client'}</div><div class="fin-kpi-val">${pending}</div></div>
        <div class="fin-kpi"><div class="fin-kpi-lbl">${L ? 'Taux acceptation' : 'Win rate'}</div><div class="fin-kpi-val">${rate}%</div></div>
        <div class="fin-kpi"><div class="fin-kpi-lbl">${L ? 'Total' : 'Total'}</div><div class="fin-kpi-val">${list.length}</div></div>
      </div>
      <div class="knw-layout">
        <div class="knw-list-panel">
          <div class="knw-list-head"><span><i class="ti ti-files"></i> ${list.length} ${L ? 'documents' : 'documents'}</span><span style="font-size:10px;color:#64748b">${L ? 'Cliquez un devis' : 'Click a quote'}</span></div>
          <div class="knw-list" id="knw-sou-list">${renderList(ctx, list)}</div>
        </div>
        <div class="knw-detail" id="knw-sou-detail">${renderDetail(ctx, sel)}</div>
      </div>
    </div>`;
  }

  function select(id) {
    selectedId = id;
    const ctx = global.getPatronModuleCtx?.();
    if (!ctx) return;
    const s = cachedList.find(x => x.id === id);
    document.querySelectorAll('#knw-sou-list .knw-row').forEach(el => el.classList.toggle('active', el.dataset.id === id));
    const det = document.getElementById('knw-sou-detail');
    if (det) det.innerHTML = renderDetail(ctx, s);
  }

  function openCreate() {
    global.openModal?.('soumission');
  }

  function openEdit(id) {
    global.openModal?.('soumission', id);
  }

  global.ChantierTrackSoumissions = {
    renderSoumissions,
    select,
    openCreate,
    openEdit,
    calcTotals,
  };
})(typeof window !== 'undefined' ? window : global);
