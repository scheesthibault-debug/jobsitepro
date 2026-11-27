/**
 * JobsitePro — Invoices + payments (Knowify)
 */
(function (global) {
  'use strict';

  const K = () => global.ChantierTrackKnowify;
  const Tax = () => global.ChantierTrackCanadaTax;
  let selectedId = null;
  let cachedList = [];

  const STATUT = {
    fr: { brouillon: 'Brouillon', envoyee: 'Envoyée', partielle: 'Partielle', payee: 'Payée', annulee: 'Annulée' },
    en: { brouillon: 'Draft', envoyee: 'Sent', partielle: 'Partial', payee: 'Paid', annulee: 'Void' },
  };
  const STAT_COL = { brouillon: '#64748b', envoyee: '#f59e0b', partielle: '#378add', payee: '#34d399', annulee: '#94a3b8' };

  const escapeHtml = (s) =>
    (global.JobsiteEscapeHtml && global.JobsiteEscapeHtml.escapeHtml
      ? global.JobsiteEscapeHtml.escapeHtml(s)
      : String(s ?? '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;'));


  function statutPill(st, lang) {
    const lbl = (STATUT[lang] || STATUT.fr)[st] || st;
    const c = STAT_COL[st] || '#64748b';
    return `<span class="dext-pill" style="color:${c};background:${c}22">${escapeHtml(lbl)}</span>`;
  }

  function calcTotals(lignes, province) {
    const ht = (lignes || []).reduce((a, l) => a + (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0), 0);
    if (Tax()?.calcFromAmount) return Tax().calcFromAmount(ht, province);
    const tps = province === 'QC' || province === 'ON' ? ht * 0.05 : ht * 0.05;
    const tvq = province === 'QC' ? ht * 0.09975 : 0;
    return { montant_ht: ht, montant_tps: tps, montant_tvq: tvq, montant_ttc: ht + tps + tvq };
  }

  function defaultLignes() {
    return [{ description: '', quantite: 1, prix_unitaire: 0 }];
  }

  function renderList(ctx, list) {
    const L = ctx.lang === 'fr';
    if (!list.length) {
      return `<div class="knw-list-empty"><i class="ti ti-file-invoice"></i><strong>${L ? 'Aucune facture' : 'No invoices'}</strong><span>${L ? 'Créez une facture — elle apparaîtra comme un document.' : 'Create an invoice document.'}</span></div>`;
    }
    return list.map(f => {
      const active = selectedId === f.id ? ' active' : '';
      const st = f.statut || 'brouillon';
      const client = f.expand?.client?.nom || '–';
      return `<button type="button" class="knw-row${active}" data-id="${f.id}" onclick="ChantierTrackFactures.select('${f.id}')">
        <div class="knw-avatar knw-avatar--invoice"><i class="ti ti-file-invoice"></i></div>
        <div class="knw-row-main">
          <div class="knw-row-top">
            <span class="knw-row-title">${escapeHtml(client)}</span>
            <span class="knw-row-amt">${ctx.fmtMoney(f.montant_ttc)}</span>
          </div>
          <div class="knw-row-meta">
            ${statutPill(st, ctx.lang)}
            <span>${escapeHtml(f.numero || '')}</span>
            <span>·</span>
            <span>${L ? 'Solde' : 'Bal.'} ${ctx.fmtMoney(f.solde ?? f.montant_ttc)}</span>
            ${f.date_echeance ? `<span>·</span><span>${ctx.fmtDate(f.date_echeance)}</span>` : ''}
          </div>
        </div>
      </button>`;
    }).join('');
  }

  function renderDetail(ctx, f) {
    const L = ctx.lang === 'fr';
    if (!f) {
      return `<div class="knw-detail-empty"><i class="ti ti-file-search"></i><strong>${L ? 'Sélectionnez une facture' : 'Select an invoice'}</strong><span>${L ? 'Aperçu du document et lignes à droite.' : 'Document preview and lines on the right.'}</span></div>`;
    }
    const st = f.statut || 'brouillon';
    const lignes = Array.isArray(f.lignes) ? f.lignes : [];
    const linesHtml = lignes.length
      ? lignes.slice(0, 12).map(ln => {
          const sub = (Number(ln.quantite) || 0) * (Number(ln.prix_unitaire) || 0);
          return `<div class="knw-line-mini"><span>${escapeHtml(ln.description || '–')} × ${ln.quantite || 0}</span><span>${sub.toFixed(2)} $</span></div>`;
        }).join('') + (lignes.length > 12 ? `<div style="font-size:11px;color:#64748b;padding-top:6px">+${lignes.length - 12}…</div>` : '')
      : `<div class="knw-list-empty" style="padding:12px"><span>${L ? 'Aucune ligne' : 'No lines'}</span></div>`;

    return `
      <div class="knw-doc-banner">
        <div class="knw-doc-banner-icon knw-doc-banner-icon--invoice"><i class="ti ti-file-invoice"></i></div>
        <div class="knw-doc-banner-body">
          <h3>${escapeHtml(f.expand?.client?.nom || (L ? 'Facture' : 'Invoice'))}</h3>
          <p>${statutPill(st, ctx.lang)} · ${escapeHtml(f.numero || '–')}</p>
        </div>
        <div class="knw-doc-banner-amt">${ctx.fmtMoney(f.montant_ttc)}</div>
      </div>
      <div class="knw-detail-body">
        <div class="knw-detail-grid">
          <div class="knw-detail-row"><span>${L ? 'Chantier' : 'Site'}</span><span>${escapeHtml(f.expand?.site?.name || '–')}</span></div>
          <div class="knw-detail-row"><span>${L ? 'Émission' : 'Issued'}</span><span>${ctx.fmtDate(f.date_emission)}</span></div>
          <div class="knw-detail-row"><span>${L ? 'Échéance' : 'Due'}</span><span>${ctx.fmtDate(f.date_echeance)}</span></div>
          <div class="knw-detail-row"><span>${L ? 'Payé' : 'Paid'}</span><span>${ctx.fmtMoney(f.montant_paye || 0)}</span></div>
          <div class="knw-detail-row"><span>${L ? 'Solde' : 'Balance'}</span><span style="color:#f59e0b;font-weight:700">${ctx.fmtMoney(f.solde ?? f.montant_ttc)}</span></div>
        </div>
        <div class="knw-detail-section">
          <h4>${L ? 'Lignes de facture' : 'Invoice lines'}</h4>
          ${linesHtml}
        </div>
      </div>
      <div class="knw-detail-actions">
        <button type="button" class="btn btn-p btn-sm" onclick="ChantierTrackFactures.openEdit('${f.id}')"><i class="ti ti-edit"></i> ${L ? 'Ouvrir' : 'Open'}</button>
        ${st === 'envoyee' && !f.relance_envoyee ? `<button type="button" class="btn btn-sm" onclick="ChantierTrackFactures.sendReminder('${f.id}')"><i class="ti ti-bell"></i> ${L ? 'Relance' : 'Reminder'}</button>` : ''}
        <button type="button" class="btn btn-sm" onclick="ChantierTrackFactures.openPayment()"><i class="ti ti-cash"></i> ${L ? 'Paiement' : 'Payment'}</button>
      </div>`;
  }

  async function render(ctx) {
    const host = document.getElementById('factures-root');
    if (!host) return;
    const L = ctx.lang === 'fr';
    const c = ctx.co();
    let list = [];
    try {
      const res = await ctx.apiList('factures', `company="${c}"`, 'client,site', '-created', 200);
      list = res.items || [];
    } catch {
      host.innerHTML = K().missingCollectionHtml(ctx.lang, L ? 'Factures' : 'Invoices');
      return;
    }
    cachedList = list;
    if (!selectedId && list.length) selectedId = list[0].id;
    if (selectedId && !list.find(x => x.id === selectedId)) selectedId = list[0]?.id || null;
    const sel = list.find(x => x.id === selectedId);
    const overdue = list.filter(f => f.statut !== 'payee' && f.statut !== 'annulee' && f.date_echeance && new Date(f.date_echeance) < new Date()).length;
    const receivable = list.filter(f => !['payee', 'annulee'].includes(f.statut)).reduce((a, f) => a + (Number(f.solde) || Number(f.montant_ttc) || 0), 0);

    host.innerHTML = `<div class="fin-module">
      <div class="fin-hero knw-hero">
        <div>
          <h2>${L ? 'Factures' : 'Invoices'}</h2>
          <p>${L ? 'Documents de facturation — liste à gauche, aperçu et lignes à droite.' : 'Invoice documents — list on the left, preview on the right.'}</p>
        </div>
        <div class="knw-hero-actions">
          <button class="btn btn-p" onclick="ChantierTrackFactures.openCreate()"><i class="ti ti-plus"></i> ${L ? 'Nouvelle facture' : 'New invoice'}</button>
          <button class="btn btn-sm" onclick="ChantierTrackFactures.openPayment()"><i class="ti ti-cash"></i> ${L ? 'Paiement' : 'Payment'}</button>
        </div>
      </div>
      <div class="fin-kpi-row">
        <div class="fin-kpi"><div class="fin-kpi-lbl">${L ? 'À recevoir' : 'Receivable'}</div><div class="fin-kpi-val accent">${ctx.fmtMoney(receivable)}</div></div>
        <div class="fin-kpi"><div class="fin-kpi-lbl">${L ? 'En retard' : 'Overdue'}</div><div class="fin-kpi-val" style="color:#f87171">${overdue}</div></div>
        <div class="fin-kpi"><div class="fin-kpi-lbl">${L ? 'Factures' : 'Invoices'}</div><div class="fin-kpi-val">${list.length}</div></div>
      </div>
      <div class="knw-layout">
        <div class="knw-list-panel">
          <div class="knw-list-head"><span><i class="ti ti-files"></i> ${list.length} ${L ? 'documents' : 'documents'}</span><span style="font-size:10px;color:#64748b">${L ? 'Cliquez une facture' : 'Click an invoice'}</span></div>
          <div class="knw-list" id="knw-fac-list">${renderList(ctx, list)}</div>
        </div>
        <div class="knw-detail" id="knw-fac-detail">${renderDetail(ctx, sel)}</div>
      </div>
    </div>`;
  }

  function select(id) {
    selectedId = id;
    const ctx = global.getPatronModuleCtx?.();
    if (!ctx) return;
    const f = cachedList.find(x => x.id === id);
    document.querySelectorAll('#knw-fac-list .knw-row').forEach(el => el.classList.toggle('active', el.dataset.id === id));
    const det = document.getElementById('knw-fac-detail');
    if (det) det.innerHTML = renderDetail(ctx, f);
  }

  function openCreate() { global.openModal?.('facture'); }
  function openEdit(id) { global.openModal?.('facture', id); }
  function openPayment() { global.openModal?.('paiement'); }

  function lignesHtml(lignes, lang) {
    const L = lang === 'fr';
    return (lignes || defaultLignes()).map((ln, i) => `<tr data-li="${i}">
      <td><input class="form-input fac-desc" value="${ln.description || ''}" placeholder="${L ? 'Description' : 'Description'}"></td>
      <td><input class="form-input fac-qte" type="number" step="0.01" min="0" value="${ln.quantite ?? 1}" style="width:70px"></td>
      <td><input class="form-input fac-pu" type="number" step="0.01" min="0" value="${ln.prix_unitaire ?? ''}" style="width:90px"></td>
      <td style="text-align:right;font-weight:600" class="fac-sub">${((ln.quantite || 0) * (ln.prix_unitaire || 0)).toFixed(2)} $</td>
      <td><button type="button" class="btn btn-d btn-sm" onclick="ChantierTrackFactures.removeLine(${i})"><i class="ti ti-x"></i></button></td>
    </tr>`).join('');
  }

  function readLignes() {
    const rows = document.querySelectorAll('#fac-lignes tbody tr');
    return Array.from(rows).map(tr => ({
      description: tr.querySelector('.fac-desc')?.value?.trim() || '',
      quantite: parseFloat(tr.querySelector('.fac-qte')?.value) || 0,
      prix_unitaire: parseFloat(tr.querySelector('.fac-pu')?.value) || 0,
    }));
  }

  function recalcTotals() {
    const province = document.getElementById('fac-province')?.value || 'QC';
    const totals = calcTotals(readLignes(), province);
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = (v || 0).toFixed(2) + ' $'; };
    set('fac-ht', totals.montant_ht);
    set('fac-tps', totals.montant_tps);
    set('fac-tvq', totals.montant_tvq);
    set('fac-ttc', totals.montant_ttc);
    document.querySelectorAll('#fac-lignes tbody tr').forEach(tr => {
      const q = parseFloat(tr.querySelector('.fac-qte')?.value) || 0;
      const p = parseFloat(tr.querySelector('.fac-pu')?.value) || 0;
      const sub = tr.querySelector('.fac-sub');
      if (sub) sub.textContent = (q * p).toFixed(2) + ' $';
    });
  }

  function addLine() {
    const tbody = document.querySelector('#fac-lignes tbody');
    if (!tbody) return;
    const lignes = readLignes();
    lignes.push({ description: '', quantite: 1, prix_unitaire: 0 });
    tbody.innerHTML = lignesHtml(lignes, global.lang || 'fr');
    recalcTotals();
  }

  function removeLine(i) {
    const lignes = readLignes();
    lignes.splice(i, 1);
    const tbody = document.querySelector('#fac-lignes tbody');
    if (tbody) tbody.innerHTML = lignesHtml(lignes.length ? lignes : defaultLignes(), global.lang || 'fr');
    recalcTotals();
  }

  async function buildModal(ctx, editId) {
    const L = ctx.lang === 'fr';
    let rec = null;
    if (editId) try { rec = await ctx.api('GET', `/api/collections/factures/records/${editId}?expand=client,site`); } catch { /* */ }
    const [clients, sites] = await Promise.all([K().loadClients(ctx), K().loadSites(ctx)]);
    let comp = {};
    try { comp = await ctx.api('GET', `/api/collections/companies/records/${ctx.co()}`); } catch { /* */ }
    const province = rec?.province || comp.tax_province || 'QC';
    const lignes = rec?.lignes?.length ? rec.lignes : defaultLignes();
    const numero = rec?.numero || await K().nextInvoiceNumber(ctx);
    const provOpts = ['QC', 'ON', 'BC', 'AB'].map(p => `<option value="${p}" ${province === p ? 'selected' : ''}>${p}</option>`).join('');
    const stOpts = Object.keys(STATUT.fr).map(s => `<option value="${s}" ${(rec?.statut || 'brouillon') === s ? 'selected' : ''}>${(STATUT[ctx.lang] || STATUT.fr)[s]}</option>`).join('');
    global.__facEditId = editId || '';
    return `<div class="modal-header"><span class="modal-title">${editId ? (L ? 'Facture' : 'Invoice') : (L ? 'Nouvelle facture' : 'New invoice')}</span><button class="btn btn-sm" onclick="closeModal()"><i class="ti ti-x"></i></button></div>
      <div style="max-height:65vh;overflow-y:auto">
        <div class="two-col"><div class="form-group"><label class="form-label">#</label><input class="form-input" id="fac-numero" value="${numero}"></div>
        <div class="form-group"><label class="form-label">${L ? 'Statut' : 'Status'}</label><select class="form-input" id="fac-statut">${stOpts}</select></div></div>
        <div class="form-group"><label class="form-label">Client *</label><select class="form-input" id="fac-client"><option value="">—</option>${clients.map(cl => `<option value="${cl.id}" ${rec?.client === cl.id ? 'selected' : ''}>${cl.nom}</option>`).join('')}</select></div>
        <div class="form-group"><label class="form-label">${L ? 'Chantier' : 'Site'}</label><select class="form-input" id="fac-site"><option value="">—</option>${sites.map(s => `<option value="${s.id}" ${rec?.site === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}</select></div>
        <div class="two-col"><div class="form-group"><label class="form-label">${L ? 'Émission' : 'Issue'}</label><input class="form-input" id="fac-emission" type="date" value="${rec?.date_emission || new Date().toISOString().slice(0, 10)}"></div>
        <div class="form-group"><label class="form-label">${L ? 'Échéance' : 'Due'}</label><input class="form-input" id="fac-echeance" type="date" value="${rec?.date_echeance || ''}"></div></div>
        <div class="form-group"><label class="form-label">${L ? 'Province taxes' : 'Tax province'}</label><select class="form-input" id="fac-province" onchange="ChantierTrackFactures.recalcTotals()">${provOpts}</select></div>
        <table class="knowify-lines" id="fac-lignes"><thead><tr><th>${L ? 'Description' : 'Desc'}</th><th>Qté</th><th>${L ? 'Prix' : 'Price'}</th><th>${L ? 'Sous-total' : 'Sub'}</th><th></th></tr></thead><tbody>${lignesHtml(lignes, ctx.lang)}</tbody></table>
        <button type="button" class="btn btn-sm" style="margin:8px 0" onclick="ChantierTrackFactures.addLine()"><i class="ti ti-plus"></i> ${L ? 'Ligne' : 'Line'}</button>
        <div style="text-align:right;font-size:12px;color:#94a3b8;margin-top:8px">
          HT: <strong id="fac-ht">0 $</strong> · TPS: <strong id="fac-tps">0 $</strong> · TVQ: <strong id="fac-tvq">0 $</strong> · TTC: <strong id="fac-ttc" style="color:#f59e0b">0 $</strong>
        </div>
      </div>
      <div class="modal-footer"><button class="btn" onclick="closeModal()">${L ? 'Annuler' : 'Cancel'}</button><button class="btn btn-p" onclick="ChantierTrackFactures.save('${editId || ''}')">${L ? 'Enregistrer' : 'Save'}</button></div>`;
  }

  async function buildPaymentModal(ctx) {
    const L = ctx.lang === 'fr';
    const c = ctx.co();
    let factures = [];
    try {
      const res = await ctx.apiList('factures', `company="${c}"&&statut!="payee"&&statut!="annulee"`, 'client', '-created', 100);
      factures = res.items || [];
    } catch { /* */ }
    const clients = await K().loadClients(ctx);
    const methOpts = ['virement', 'cheque', 'comptant', 'carte', 'autre'].map(m => `<option value="${m}">${m}</option>`).join('');
    return K().modalShell(
      L ? 'Enregistrer un paiement' : 'Record payment',
      `<div class="form-group"><label class="form-label">${L ? 'Facture' : 'Invoice'}</label><select class="form-input" id="pay-facture"><option value="">—</option>${factures.map(f => `<option value="${f.id}">${f.numero} — ${f.expand?.client?.nom || ''} (${(f.solde ?? f.montant_ttc)?.toFixed?.(2) || f.montant_ttc} $)</option>`).join('')}</select></div>
       <div class="form-group"><label class="form-label">Client</label><select class="form-input" id="pay-client"><option value="">—</option>${clients.map(cl => `<option value="${cl.id}">${cl.nom}</option>`).join('')}</select></div>
       <div class="two-col"><div class="form-group"><label class="form-label">${L ? 'Montant' : 'Amount'} *</label><input class="form-input" id="pay-montant" type="number" step="0.01" min="0"></div>
       <div class="form-group"><label class="form-label">${L ? 'Date' : 'Date'}</label><input class="form-input" id="pay-date" type="date" value="${new Date().toISOString().slice(0, 10)}"></div></div>
       <div class="form-group"><label class="form-label">${L ? 'Méthode' : 'Method'}</label><select class="form-input" id="pay-methode">${methOpts}</select></div>
       <div class="form-group"><label class="form-label">${L ? 'Référence' : 'Reference'}</label><input class="form-input" id="pay-ref"></div>`,
      `<button class="btn" onclick="closeModal()">${L ? 'Annuler' : 'Cancel'}</button>
       <button class="btn btn-p" onclick="ChantierTrackFactures.savePayment()">${L ? 'Enregistrer' : 'Save'}</button>`
    );
  }

  function bindRecalc() {
    document.getElementById('modal-content')?.addEventListener('input', e => {
      if (e.target.closest('#fac-lignes')) recalcTotals();
    });
    recalcTotals();
  }

  async function save(editId) {
    const ctx = global.getPatronModuleCtx?.();
    if (!ctx) return;
    const L = ctx.lang === 'fr';
    const clientId = document.getElementById('fac-client')?.value;
    if (!clientId) { ctx.showToast(L ? 'Client requis' : 'Client required', false); return; }
    const province = document.getElementById('fac-province')?.value || 'QC';
    const lignes = readLignes();
    const totals = calcTotals(lignes, province);
    const ttc = totals.montant_ttc || 0;
    const paid = editId ? (await ctx.api('GET', `/api/collections/factures/records/${editId}`).catch(() => ({}))).montant_paye || 0 : 0;
    const body = {
      company: ctx.co(),
      created_by: ctx.uid(),
      client: clientId,
      site: document.getElementById('fac-site')?.value || null,
      numero: document.getElementById('fac-numero')?.value?.trim(),
      province,
      lignes,
      montant_ht: totals.montant_ht,
      montant_tps: totals.montant_tps,
      montant_tvq: totals.montant_tvq || 0,
      montant_ttc: ttc,
      montant_paye: paid,
      solde: Math.max(0, ttc - paid),
      statut: document.getElementById('fac-statut')?.value || 'brouillon',
      date_emission: document.getElementById('fac-emission')?.value,
      date_echeance: document.getElementById('fac-echeance')?.value || null,
      relance_envoyee: false,
    };
    try {
      let id = editId;
      if (editId) await ctx.api('PATCH', `/api/collections/factures/records/${editId}`, body);
      else {
        const created = await ctx.api('POST', '/api/collections/factures/records', body);
        id = created.id;
        selectedId = id;
      }
      await K().logActivity(ctx, { entityType: 'facture', entityId: id, activity: editId ? 'updated' : 'created', message: body.numero });
      ctx.showToast(ctx.t('saved'));
      global.closeModal?.();
      render(ctx);
    } catch (e) { ctx.showToast(e.message, false); }
  }

  async function savePayment() {
    const ctx = global.getPatronModuleCtx?.();
    if (!ctx) return;
    const L = ctx.lang === 'fr';
    const montant = parseFloat(document.getElementById('pay-montant')?.value);
    if (!montant || montant <= 0) { ctx.showToast(L ? 'Montant invalide' : 'Invalid amount', false); return; }
    const factureId = document.getElementById('pay-facture')?.value || null;
    const clientId = document.getElementById('pay-client')?.value || null;
    try {
      const pay = await ctx.api('POST', '/api/collections/paiements/records', {
        company: ctx.co(),
        facture: factureId,
        client: clientId,
        montant,
        date_paiement: document.getElementById('pay-date')?.value,
        methode: document.getElementById('pay-methode')?.value || 'virement',
        reference: document.getElementById('pay-ref')?.value?.trim() || '',
      });
      if (factureId) {
        const fac = await ctx.api('GET', `/api/collections/factures/records/${factureId}`);
        const newPaid = (Number(fac.montant_paye) || 0) + montant;
        const ttc = Number(fac.montant_ttc) || 0;
        const solde = Math.max(0, ttc - newPaid);
        let statut = 'partielle';
        if (solde <= 0.01) statut = 'payee';
        else if (newPaid <= 0) statut = fac.statut;
        await ctx.api('PATCH', `/api/collections/factures/records/${factureId}`, { montant_paye: newPaid, solde, statut });
      }
      await K().logActivity(ctx, { entityType: 'paiement', entityId: pay.id, activity: 'paid', message: ctx.fmtMoney(montant) });
      ctx.showToast(L ? 'Paiement enregistré' : 'Payment recorded');
      global.closeModal?.();
      render(ctx);
    } catch (e) { ctx.showToast(e.message, false); }
  }

  async function sendReminder(factureId) {
    const ctx = global.getPatronModuleCtx?.();
    if (!ctx) return;
    const L = ctx.lang === 'fr';
    try {
      const fac = await ctx.api('GET', `/api/collections/factures/records/${factureId}?expand=client`);
      await ctx.api('PATCH', `/api/collections/factures/records/${factureId}`, { relance_envoyee: true });
      await K().logActivity(ctx, { entityType: 'facture', entityId: factureId, activity: 'comment', message: L ? `Relance envoyée — ${fac.numero}` : `Reminder sent — ${fac.numero}` });
      ctx.showToast(L ? 'Relance marquée (email à brancher)' : 'Reminder flagged (email TBD)');
      render(ctx);
    } catch (e) { ctx.showToast(e.message, false); }
  }

  global.ChantierTrackFactures = {
    render, select, openCreate, openEdit, openPayment, buildModal, buildPaymentModal,
    bindRecalc, recalcTotals, addLine, removeLine, save, savePayment, sendReminder,
  };
})(typeof window !== 'undefined' ? window : global);
