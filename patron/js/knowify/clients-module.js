/**
 * JobsitePro — Clients CRM (inbox Knowify)
 */
(function (global) {
  'use strict';

  const K = () => global.ChantierTrackKnowify;
  let selectedId = null;
  let cachedList = [];

  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function initials(name) {
    const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function renderList(ctx, list) {
    const L = ctx.lang === 'fr';
    if (!list.length) {
      return `<div class="knw-list-empty"><i class="ti ti-users"></i><strong>${L ? 'Aucun client' : 'No clients'}</strong><span>${L ? 'Ajoutez votre premier client pour le CRM.' : 'Add your first client.'}</span></div>`;
    }
    return list.map(cl => {
      const active = selectedId === cl.id ? ' active' : '';
      return `<button type="button" class="knw-row${active}" data-id="${cl.id}" onclick="ChantierTrackClients.select('${cl.id}')">
        <div class="knw-avatar">${escapeHtml(initials(cl.nom))}</div>
        <div class="knw-row-main">
          <div class="knw-row-top">
            <span class="knw-row-title">${escapeHtml(cl.nom)}</span>
            ${cl.is_active === false ? `<span class="dext-pill dext-status-rejected">${L ? 'Inactif' : 'Inactive'}</span>` : ''}
          </div>
          <div class="knw-row-meta">
            ${cl.ville ? `<span>${escapeHtml(cl.ville)}</span>` : ''}
            ${cl.telephone ? `<span>·</span><span>${escapeHtml(cl.telephone)}</span>` : ''}
            ${cl.email ? `<span>·</span><span>${escapeHtml(cl.email)}</span>` : ''}
          </div>
        </div>
      </button>`;
    }).join('');
  }

  function renderDetail(ctx, cl) {
    const L = ctx.lang === 'fr';
    if (!cl) {
      return `<div class="knw-detail-empty"><i class="ti ti-user-search"></i><strong>${L ? 'Sélectionnez un client' : 'Select a client'}</strong><span>${L ? 'Cliquez une fiche à gauche pour voir les coordonnées.' : 'Click a contact on the left.'}</span></div>`;
    }
    return `
      <div class="knw-doc-banner">
        <div class="knw-doc-banner-icon knw-doc-banner-icon--client">${escapeHtml(initials(cl.nom))}</div>
        <div class="knw-doc-banner-body">
          <h3>${escapeHtml(cl.nom)}</h3>
          <p>${cl.is_active === false ? (L ? 'Client inactif' : 'Inactive client') : (L ? 'Fiche client' : 'Client record')}</p>
        </div>
      </div>
      <div class="knw-detail-body">
        <div class="knw-detail-grid">
          <div class="knw-detail-row"><span>Email</span><span>${cl.email ? `<a href="mailto:${escapeHtml(cl.email)}" style="color:#38bdf8">${escapeHtml(cl.email)}</a>` : '–'}</span></div>
          <div class="knw-detail-row"><span>${L ? 'Téléphone' : 'Phone'}</span><span>${cl.telephone ? `<a href="tel:${escapeHtml(cl.telephone)}" style="color:#38bdf8">${escapeHtml(cl.telephone)}</a>` : '–'}</span></div>
          <div class="knw-detail-row"><span>${L ? 'Adresse' : 'Address'}</span><span>${escapeHtml(cl.adresse || '–')}</span></div>
          <div class="knw-detail-row"><span>${L ? 'Ville' : 'City'}</span><span>${escapeHtml(cl.ville || '–')}</span></div>
          <div class="knw-detail-row"><span>${L ? 'Code postal' : 'Postal'}</span><span>${escapeHtml(cl.code_postal || '–')}</span></div>
          <div class="knw-detail-row"><span>${L ? 'Notes' : 'Notes'}</span><span>${escapeHtml(cl.notes || '–')}</span></div>
        </div>
      </div>
      <div class="knw-detail-actions">
        <button type="button" class="btn btn-p btn-sm" onclick="ChantierTrackClients.openEdit('${cl.id}')"><i class="ti ti-edit"></i> ${L ? 'Modifier' : 'Edit'}</button>
        ${cl.email ? `<a class="btn btn-sm" href="mailto:${escapeHtml(cl.email)}"><i class="ti ti-mail"></i> ${L ? 'Courriel' : 'Email'}</a>` : ''}
        ${cl.telephone ? `<a class="btn btn-sm" href="tel:${escapeHtml(cl.telephone)}"><i class="ti ti-phone"></i> ${L ? 'Appeler' : 'Call'}</a>` : ''}
      </div>`;
  }

  async function render(ctx) {
    const host = document.getElementById('clients-root');
    if (!host) return;
    const L = ctx.lang === 'fr';
    const c = ctx.co();
    let list = [];
    try {
      const res = await ctx.apiList('clients', `company="${c}"`, '', 'nom', 500);
      list = res.items || [];
    } catch {
      host.innerHTML = K().missingCollectionHtml(ctx.lang, L ? 'Clients' : 'Clients');
      return;
    }
    cachedList = list;
    if (!selectedId && list.length) selectedId = list[0].id;
    if (selectedId && !list.find(x => x.id === selectedId)) selectedId = list[0]?.id || null;
    const sel = list.find(x => x.id === selectedId);
    const active = list.filter(x => x.is_active !== false).length;

    host.innerHTML = `<div class="fin-module">
      <div class="fin-hero knw-hero">
        <div>
          <h2>${L ? 'Clients' : 'Clients'}</h2>
          <p>${L ? 'Carnet de contacts chantier — cliquez une fiche pour voir le détail à droite.' : 'Job site contacts — click a card to see details on the right.'}</p>
        </div>
        <div class="knw-hero-actions">
          <button class="btn btn-p" onclick="ChantierTrackClients.openCreate()"><i class="ti ti-plus"></i> ${L ? 'Nouveau client' : 'New client'}</button>
        </div>
      </div>
      <div class="fin-kpi-row">
        <div class="fin-kpi"><div class="fin-kpi-lbl">${L ? 'Total clients' : 'Total'}</div><div class="fin-kpi-val">${list.length}</div></div>
        <div class="fin-kpi"><div class="fin-kpi-lbl">${L ? 'Actifs' : 'Active'}</div><div class="fin-kpi-val accent">${active}</div></div>
      </div>
      <div class="knw-layout">
        <div class="knw-list-panel">
          <div class="knw-list-head"><span><i class="ti ti-address-book"></i> ${list.length} ${L ? 'fiches' : 'records'}</span><span style="font-size:10px;color:#64748b">${L ? 'Cliquez une fiche' : 'Click a contact'}</span></div>
          <div class="knw-list" id="knw-clients-list">${renderList(ctx, list)}</div>
        </div>
        <div class="knw-detail" id="knw-clients-detail">${renderDetail(ctx, sel)}</div>
      </div>
    </div>`;
  }

  function select(id) {
    selectedId = id;
    const ctx = global.getPatronModuleCtx?.();
    if (!ctx) return;
    const cl = cachedList.find(x => x.id === id);
    document.querySelectorAll('#knw-clients-list .knw-row').forEach(el => el.classList.toggle('active', el.dataset.id === id));
    const det = document.getElementById('knw-clients-detail');
    if (det) det.innerHTML = renderDetail(ctx, cl);
  }

  function openCreate() { global.openModal?.('client'); }
  function openEdit(id) { global.openModal?.('client', id); }

  async function buildModal(ctx, editId) {
    const L = ctx.lang === 'fr';
    let rec = null;
    if (editId) {
      try { rec = await ctx.api('GET', `/api/collections/clients/records/${editId}`); } catch { /* */ }
    }
    const v = k => rec?.[k] ?? '';
    return K().modalShell(
      editId ? (L ? 'Modifier client' : 'Edit client') : (L ? 'Nouveau client' : 'New client'),
      `<div class="form-group"><label class="form-label">${L ? 'Nom' : 'Name'} *</label><input class="form-input" id="cl-nom" value="${escapeHtml(v('nom'))}"></div>
       <div class="two-col"><div class="form-group"><label class="form-label">Email</label><input class="form-input" id="cl-email" type="email" value="${escapeHtml(v('email'))}"></div>
       <div class="form-group"><label class="form-label">${L ? 'Téléphone' : 'Phone'}</label><input class="form-input" id="cl-tel" value="${escapeHtml(v('telephone'))}"></div></div>
       <div class="form-group"><label class="form-label">${L ? 'Adresse' : 'Address'}</label><input class="form-input" id="cl-adr" value="${escapeHtml(v('adresse'))}"></div>
       <div class="two-col"><div class="form-group"><label class="form-label">${L ? 'Ville' : 'City'}</label><input class="form-input" id="cl-ville" value="${escapeHtml(v('ville'))}"></div>
       <div class="form-group"><label class="form-label">${L ? 'Code postal' : 'Postal'}</label><input class="form-input" id="cl-cp" value="${escapeHtml(v('code_postal'))}"></div></div>
       <div class="form-group"><label class="form-label">${L ? 'Notes' : 'Notes'}</label><textarea class="form-input" id="cl-notes" rows="2">${escapeHtml(v('notes'))}</textarea></div>`,
      `<button class="btn" onclick="closeModal()">${L ? 'Annuler' : 'Cancel'}</button>
       <button class="btn btn-p" onclick="ChantierTrackClients.save('${editId || ''}')">${L ? 'Enregistrer' : 'Save'}</button>`
    );
  }

  async function save(editId) {
    const ctx = global.getPatronModuleCtx?.();
    if (!ctx) return;
    const L = ctx.lang === 'fr';
    const nom = document.getElementById('cl-nom')?.value?.trim();
    if (!nom) { ctx.showToast(L ? 'Nom requis' : 'Name required', false); return; }
    const body = {
      company: ctx.co(),
      nom,
      email: document.getElementById('cl-email')?.value?.trim() || '',
      telephone: document.getElementById('cl-tel')?.value?.trim() || '',
      adresse: document.getElementById('cl-adr')?.value?.trim() || '',
      ville: document.getElementById('cl-ville')?.value?.trim() || '',
      code_postal: document.getElementById('cl-cp')?.value?.trim() || '',
      notes: document.getElementById('cl-notes')?.value?.trim() || '',
      is_active: true,
    };
    try {
      let id = editId;
      if (editId) await ctx.api('PATCH', `/api/collections/clients/records/${editId}`, body);
      else {
        const created = await ctx.api('POST', '/api/collections/clients/records', body);
        id = created.id;
        selectedId = id;
      }
      await K().logActivity(ctx, { entityType: 'client', entityId: id, activity: editId ? 'updated' : 'created', message: `${nom} — ${editId ? 'modifié' : 'créé'}` });
      ctx.showToast(ctx.t('saved'));
      global.closeModal?.();
      render(ctx);
    } catch (e) { ctx.showToast(e.message, false); }
  }

  global.ChantierTrackClients = { render, select, openCreate, openEdit, buildModal, save };
})(typeof window !== 'undefined' ? window : global);
