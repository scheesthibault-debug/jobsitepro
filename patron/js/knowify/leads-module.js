/**
 * JobsitePro — Leads CRM (inbox Knowify)
 */
(function (global) {
  'use strict';

  const K = () => global.ChantierTrackKnowify;
  let selectedId = null;
  let cachedList = [];

  const STATUT = {
    fr: { nouveau: 'Nouveau', contacte: 'Contacté', qualifie: 'Qualifié', perdu: 'Perdu', converti: 'Converti' },
    en: { nouveau: 'New', contacte: 'Contacted', qualifie: 'Qualified', perdu: 'Lost', converti: 'Converted' },
  };
  const COLORS = { nouveau: '#64748b', contacte: '#f59e0b', qualifie: '#34d399', perdu: '#f87171', converti: '#378add' };

  const escapeHtml = (s) =>
    (global.JobsiteEscapeHtml && global.JobsiteEscapeHtml.escapeHtml
      ? global.JobsiteEscapeHtml.escapeHtml(s)
      : String(s ?? '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;'));


  function statusPill(st, lang) {
    const lbl = (STATUT[lang] || STATUT.fr)[st] || st;
    const c = COLORS[st] || '#64748b';
    return `<span class="dext-pill" style="color:${c};background:${c}22">${escapeHtml(lbl)}</span>`;
  }

  function renderList(ctx, list) {
    const L = ctx.lang === 'fr';
    if (!list.length) {
      return `<div class="knw-list-empty"><i class="ti ti-target"></i><strong>${L ? 'Aucun lead' : 'No leads'}</strong><span>${L ? 'Ajoutez un prospect pour démarrer le pipeline.' : 'Add a prospect to start the pipeline.'}</span></div>`;
    }
    return list.map(l => {
      const active = selectedId === l.id ? ' active' : '';
      const st = l.statut || 'nouveau';
      return `<button type="button" class="knw-row${active}" data-id="${l.id}" onclick="ChantierTrackLeads.select('${l.id}')">
        <div class="knw-avatar knw-avatar--lead"><i class="ti ti-target-arrow"></i></div>
        <div class="knw-row-main">
          <div class="knw-row-top">
            <span class="knw-row-title">${escapeHtml(l.nom)}</span>
            ${l.valeur_estimee ? `<span class="knw-row-amt">${ctx.fmtMoney(l.valeur_estimee)}</span>` : ''}
          </div>
          <div class="knw-row-meta">
            ${statusPill(st, ctx.lang)}
            ${l.source ? `<span>·</span><span>${escapeHtml(l.source)}</span>` : ''}
            ${l.telephone ? `<span>·</span><span>${escapeHtml(l.telephone)}</span>` : ''}
          </div>
        </div>
      </button>`;
    }).join('');
  }

  function renderDetail(ctx, l) {
    const L = ctx.lang === 'fr';
    if (!l) {
      return `<div class="knw-detail-empty"><i class="ti ti-click"></i><strong>${L ? 'Sélectionnez un lead' : 'Select a lead'}</strong><span>${L ? 'Voir le détail et convertir en client.' : 'View details and convert to client.'}</span></div>`;
    }
    const st = l.statut || 'nouveau';
    const canConvert = st !== 'converti';
    return `
      <div class="knw-doc-banner">
        <div class="knw-doc-banner-icon knw-doc-banner-icon--lead"><i class="ti ti-target-arrow"></i></div>
        <div class="knw-doc-banner-body">
          <h3>${escapeHtml(l.nom)}</h3>
          <p>${statusPill(st, ctx.lang)} ${l.source ? `· ${escapeHtml(l.source)}` : ''}</p>
        </div>
        ${l.valeur_estimee ? `<div class="knw-doc-banner-amt">${ctx.fmtMoney(l.valeur_estimee)}</div>` : ''}
      </div>
      <div class="knw-detail-body">
        <div class="knw-detail-grid">
          <div class="knw-detail-row"><span>Email</span><span>${l.email ? `<a href="mailto:${escapeHtml(l.email)}" style="color:#38bdf8">${escapeHtml(l.email)}</a>` : '–'}</span></div>
          <div class="knw-detail-row"><span>${L ? 'Téléphone' : 'Phone'}</span><span>${escapeHtml(l.telephone || '–')}</span></div>
          <div class="knw-detail-row"><span>${L ? 'Source' : 'Source'}</span><span>${escapeHtml(l.source || '–')}</span></div>
          <div class="knw-detail-row"><span>${L ? 'Valeur estimée' : 'Est. value'}</span><span>${l.valeur_estimee ? ctx.fmtMoney(l.valeur_estimee) : '–'}</span></div>
          <div class="knw-detail-row"><span>${L ? 'Notes' : 'Notes'}</span><span>${escapeHtml(l.notes || '–')}</span></div>
        </div>
      </div>
      <div class="knw-detail-actions">
        <button type="button" class="btn btn-p btn-sm" onclick="ChantierTrackLeads.openEdit('${l.id}')"><i class="ti ti-edit"></i> ${L ? 'Modifier' : 'Edit'}</button>
        ${canConvert ? `<button type="button" class="btn btn-g btn-sm" onclick="ChantierTrackLeads.convertToClient('${l.id}')"><i class="ti ti-user-check"></i> ${L ? '→ Client' : '→ Client'}</button>` : ''}
        ${l.email ? `<a class="btn btn-sm" href="mailto:${escapeHtml(l.email)}"><i class="ti ti-mail"></i></a>` : ''}
      </div>`;
  }

  async function render(ctx) {
    const host = document.getElementById('prospects-root');
    if (!host) return;
    const L = ctx.lang === 'fr';
    const c = ctx.co();
    let list = [];
    try {
      const res = await ctx.apiList('leads', `company="${c}"`, 'client', '-created', 300);
      list = res.items || [];
    } catch {
      host.innerHTML = K().missingCollectionHtml(ctx.lang, 'Leads');
      return;
    }
    cachedList = list;
    if (!selectedId && list.length) selectedId = list[0].id;
    if (selectedId && !list.find(x => x.id === selectedId)) selectedId = list[0]?.id || null;
    const sel = list.find(x => x.id === selectedId);
    const cols = ['nouveau', 'contacte', 'qualifie', 'converti', 'perdu'];
    const pipeline = list.filter(x => !['perdu', 'converti'].includes(x.statut)).reduce((a, x) => a + (Number(x.valeur_estimee) || 0), 0);
    const activeN = list.filter(x => !['perdu', 'converti'].includes(x.statut)).length;

    host.innerHTML = `<div class="fin-module">
      <div class="fin-hero knw-hero">
        <div>
          <h2>${L ? 'Leads / Prospects' : 'Leads'}</h2>
          <p>${L ? 'Pipeline commercial — fiches à gauche, détail à droite. Convertissez un lead en client en un clic.' : 'Sales pipeline — list on the left, details on the right.'}</p>
        </div>
        <div class="knw-hero-actions">
          <button class="btn btn-p" onclick="ChantierTrackLeads.openCreate()"><i class="ti ti-plus"></i> ${L ? 'Nouveau lead' : 'New lead'}</button>
        </div>
      </div>
      <div class="fin-kpi-row">
        <div class="fin-kpi"><div class="fin-kpi-lbl">${L ? 'Pipeline' : 'Pipeline'}</div><div class="fin-kpi-val accent">${ctx.fmtMoney(pipeline)}</div></div>
        <div class="fin-kpi"><div class="fin-kpi-lbl">${L ? 'Leads actifs' : 'Active leads'}</div><div class="fin-kpi-val">${activeN}</div></div>
      </div>
      <div class="knw-pipeline">
        ${cols.map(st => {
          const n = list.filter(x => (x.statut || 'nouveau') === st).length;
          const lbl = (STATUT[ctx.lang] || STATUT.fr)[st];
          return `<div class="knw-pipe-chip"><div class="knw-pipe-chip-lbl">${lbl}</div><div class="knw-pipe-chip-val" style="color:${COLORS[st]}">${n}</div></div>`;
        }).join('')}
      </div>
      <div class="knw-layout">
        <div class="knw-list-panel">
          <div class="knw-list-head"><span><i class="ti ti-stack-2"></i> ${list.length} ${L ? 'prospects' : 'leads'}</span><span style="font-size:10px;color:#64748b">${L ? 'Cliquez une fiche' : 'Click a lead'}</span></div>
          <div class="knw-list" id="knw-leads-list">${renderList(ctx, list)}</div>
        </div>
        <div class="knw-detail" id="knw-leads-detail">${renderDetail(ctx, sel)}</div>
      </div>
    </div>`;
  }

  function select(id) {
    selectedId = id;
    const ctx = global.getPatronModuleCtx?.();
    if (!ctx) return;
    const l = cachedList.find(x => x.id === id);
    document.querySelectorAll('#knw-leads-list .knw-row').forEach(el => el.classList.toggle('active', el.dataset.id === id));
    const det = document.getElementById('knw-leads-detail');
    if (det) det.innerHTML = renderDetail(ctx, l);
  }

  function openCreate() { global.openModal?.('lead'); }
  function openEdit(id) { global.openModal?.('lead', id); }

  async function buildModal(ctx, editId) {
    const L = ctx.lang === 'fr';
    let rec = null;
    if (editId) try { rec = await ctx.api('GET', `/api/collections/leads/records/${editId}`); } catch { /* */ }
    const v = k => rec?.[k] ?? '';
    const stOpts = Object.keys(STATUT.fr).map(s => `<option value="${s}" ${v('statut') === s ? 'selected' : ''}>${(STATUT[ctx.lang] || STATUT.fr)[s]}</option>`).join('');
    const canConvert = rec && rec.statut !== 'converti';
    return K().modalShell(
      editId ? 'Lead' : (L ? 'Nouveau lead' : 'New lead'),
      `<div class="form-group"><label class="form-label">${L ? 'Nom' : 'Name'} *</label><input class="form-input" id="ld-nom" value="${escapeHtml(v('nom'))}"></div>
       <div class="two-col"><div class="form-group"><label class="form-label">Email</label><input class="form-input" id="ld-email" type="email" value="${escapeHtml(v('email'))}"></div>
       <div class="form-group"><label class="form-label">${L ? 'Téléphone' : 'Phone'}</label><input class="form-input" id="ld-tel" value="${escapeHtml(v('telephone'))}"></div></div>
       <div class="two-col"><div class="form-group"><label class="form-label">${L ? 'Source' : 'Source'}</label><input class="form-input" id="ld-source" value="${escapeHtml(v('source'))}" placeholder="Web, référence…"></div>
       <div class="form-group"><label class="form-label">${L ? 'Valeur estimée' : 'Est. value'}</label><input class="form-input" id="ld-val" type="number" step="0.01" value="${v('valeur_estimee') || ''}"></div></div>
       <div class="form-group"><label class="form-label">${L ? 'Statut' : 'Status'}</label><select class="form-input" id="ld-statut">${stOpts}</select></div>
       <div class="form-group"><label class="form-label">${L ? 'Notes' : 'Notes'}</label><textarea class="form-input" id="ld-notes" rows="2">${escapeHtml(v('notes'))}</textarea></div>
       ${canConvert ? `<button type="button" class="btn btn-p" style="width:100%;margin-top:8px" onclick="ChantierTrackLeads.convertToClient('${editId}')"><i class="ti ti-user-check"></i> ${L ? 'Convertir en client' : 'Convert to client'}</button>` : ''}`,
      `<button class="btn" onclick="closeModal()">${L ? 'Annuler' : 'Cancel'}</button>
       <button class="btn btn-p" onclick="ChantierTrackLeads.save('${editId || ''}')">${L ? 'Enregistrer' : 'Save'}</button>`
    );
  }

  async function save(editId) {
    const ctx = global.getPatronModuleCtx?.();
    if (!ctx) return;
    const L = ctx.lang === 'fr';
    const nom = document.getElementById('ld-nom')?.value?.trim();
    if (!nom) { ctx.showToast(L ? 'Nom requis' : 'Name required', false); return; }
    const body = {
      company: ctx.co(),
      nom,
      email: document.getElementById('ld-email')?.value?.trim() || '',
      telephone: document.getElementById('ld-tel')?.value?.trim() || '',
      source: document.getElementById('ld-source')?.value?.trim() || '',
      valeur_estimee: parseFloat(document.getElementById('ld-val')?.value) || 0,
      statut: document.getElementById('ld-statut')?.value || 'nouveau',
      notes: document.getElementById('ld-notes')?.value?.trim() || '',
    };
    try {
      let id = editId;
      if (editId) await ctx.api('PATCH', `/api/collections/leads/records/${editId}`, body);
      else {
        const created = await ctx.api('POST', '/api/collections/leads/records', body);
        id = created.id;
        selectedId = id;
      }
      await K().logActivity(ctx, { entityType: 'lead', entityId: id, activity: editId ? 'updated' : 'created', message: nom });
      ctx.showToast(ctx.t('saved'));
      global.closeModal?.();
      render(ctx);
    } catch (e) { ctx.showToast(e.message, false); }
  }

  async function convertToClient(leadId) {
    const ctx = global.getPatronModuleCtx?.();
    if (!ctx || !leadId) return;
    const L = ctx.lang === 'fr';
    try {
      const lead = await ctx.api('GET', `/api/collections/leads/records/${leadId}`);
      const client = await ctx.api('POST', '/api/collections/clients/records', {
        company: ctx.co(),
        nom: lead.nom,
        email: lead.email || '',
        telephone: lead.telephone || '',
        notes: lead.notes || '',
        is_active: true,
      });
      await ctx.api('PATCH', `/api/collections/leads/records/${leadId}`, {
        statut: 'converti',
        client: client.id,
        converti_le: new Date().toISOString().slice(0, 10),
      });
      await K().logActivity(ctx, { entityType: 'lead', entityId: leadId, activity: 'converted', message: `${lead.nom} → client` });
      ctx.showToast(L ? 'Client créé — ouvrez Soumissions pour un devis' : 'Client created — open Quotes for estimate');
      global.closeModal?.();
      selectedId = leadId;
      render(ctx);
    } catch (e) { ctx.showToast(e.message, false); }
  }

  global.ChantierTrackLeads = { render, select, openCreate, openEdit, buildModal, save, convertToClient };
})(typeof window !== 'undefined' ? window : global);
