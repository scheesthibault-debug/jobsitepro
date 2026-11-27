/**
 * JobsitePro — Contrats
 */
(function (global) {
  'use strict';

  const K = () => global.ChantierTrackKnowify;

  const STATUT = {
    fr: { brouillon: 'Brouillon', actif: 'Actif', suspendu: 'Suspendu', termine: 'Terminé', annule: 'Annulé' },
    en: { brouillon: 'Draft', actif: 'Active', suspendu: 'Suspended', termine: 'Ended', annule: 'Cancelled' },
  };

  async function render(ctx) {
    const host = document.getElementById('contrats-root');
    if (!host) return;
    const L = ctx.lang === 'fr';
    const c = ctx.co();
    let list = [];
    try {
      const res = await ctx.apiList('contrats', `company="${c}"`, 'client,site', '-created', 100);
      list = res.items || [];
    } catch {
      host.innerHTML = K().missingCollectionHtml(ctx.lang, 'Contracts');
      return;
    }
    const active = list.filter(x => x.statut === 'actif').length;
    host.innerHTML = `<div class="fin-module">
      <div class="fin-hero"><h2>Contracts</h2><p>${L ? 'Contrats clients et ententes de service' : 'Client contracts and service agreements'}</p></div>
      <button class="btn btn-p" style="margin-bottom:14px" onclick="ChantierTrackContrats.openCreate()"><i class="ti ti-plus"></i> New contract</button>
      <div class="fin-kpi-row"><div class="fin-kpi"><div class="fin-kpi-lbl">${L ? 'Actifs' : 'Active'}</div><div class="fin-kpi-val accent">${active}</div></div></div>
      <div class="dext-gallery"><table class="knowify-lines"><thead><tr>
        <th>${L ? 'Titre' : 'Title'}</th><th>Client</th><th>${L ? 'Montant' : 'Amount'}</th><th>${L ? 'Statut' : 'Status'}</th><th>${L ? 'Fin' : 'End'}</th><th></th>
      </tr></thead><tbody>
      ${list.length ? list.map(ct => `<tr>
        <td style="font-weight:600">${ct.titre}</td>
        <td>${ct.expand?.client?.nom || '–'}</td>
        <td>${ctx.fmtMoney(ct.montant)}</td>
        <td>${K().badge((STATUT[ctx.lang] || STATUT.fr)[ct.statut] || ct.statut, ct.statut === 'actif' ? '#34d399' : '#64748b')}</td>
        <td style="font-size:11px">${ctx.fmtDate(ct.date_fin)}</td>
        <td><button class="btn btn-sm" onclick="ChantierTrackContrats.openEdit('${ct.id}')"><i class="ti ti-edit"></i></button></td>
      </tr>`).join('') : `<tr><td colspan="6" style="text-align:center;padding:32px;color:#64748b">${L ? 'Aucun contrat' : 'No contracts'}</td></tr>`}
      </tbody></table></div>
    </div>`;
  }

  function openCreate() { global.openModal?.('contrat'); }
  function openEdit(id) { global.openModal?.('contrat', id); }

  async function buildModal(ctx, editId) {
    const L = ctx.lang === 'fr';
    let rec = null;
    if (editId) try { rec = await ctx.api('GET', `/api/collections/contrats/records/${editId}`); } catch { /* */ }
    const [clients, sites] = await Promise.all([K().loadClients(ctx), K().loadSites(ctx)]);
    const v = k => rec?.[k] ?? '';
    const stOpts = Object.keys(STATUT.fr).map(s => `<option value="${s}" ${(v('statut') || 'brouillon') === s ? 'selected' : ''}>${(STATUT[ctx.lang] || STATUT.fr)[s]}</option>`).join('');
    return K().modalShell(
      editId ? 'Contract' : 'New contract',
      `<div class="form-group"><label class="form-label">${L ? 'Titre' : 'Title'} *</label><input class="form-input" id="ct-titre" value="${v('titre')}"></div>
       <div class="form-group"><label class="form-label">Client *</label><select class="form-input" id="ct-client"><option value="">—</option>${clients.map(cl => `<option value="${cl.id}" ${rec?.client === cl.id ? 'selected' : ''}>${cl.nom}</option>`).join('')}</select></div>
       <div class="form-group"><label class="form-label">${L ? 'Chantier' : 'Site'}</label><select class="form-input" id="ct-site"><option value="">—</option>${sites.map(s => `<option value="${s.id}" ${rec?.site === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}</select></div>
       <div class="form-group"><label class="form-label">${L ? 'Description' : 'Description'}</label><textarea class="form-input" id="ct-desc" rows="2">${v('description')}</textarea></div>
       <div class="two-col"><div class="form-group"><label class="form-label">${L ? 'Montant' : 'Amount'}</label><input class="form-input" id="ct-montant" type="number" step="0.01" value="${v('montant') || ''}"></div>
       <div class="form-group"><label class="form-label">${L ? 'Statut' : 'Status'}</label><select class="form-input" id="ct-statut">${stOpts}</select></div></div>
       <div class="two-col"><div class="form-group"><label class="form-label">${L ? 'Début' : 'Start'}</label><input class="form-input" id="ct-debut" type="date" value="${v('date_debut') || ''}"></div>
       <div class="form-group"><label class="form-label">${L ? 'Fin' : 'End'}</label><input class="form-input" id="ct-fin" type="date" value="${v('date_fin') || ''}"></div></div>`,
      `<button class="btn" onclick="closeModal()">${L ? 'Annuler' : 'Cancel'}</button>
       <button class="btn btn-p" onclick="ChantierTrackContrats.save('${editId || ''}')">${L ? 'Enregistrer' : 'Save'}</button>`
    );
  }

  async function save(editId) {
    const ctx = global.getPatronModuleCtx?.();
    if (!ctx) return;
    const L = ctx.lang === 'fr';
    const titre = document.getElementById('ct-titre')?.value?.trim();
    const clientId = document.getElementById('ct-client')?.value;
    if (!titre || !clientId) { ctx.showToast(L ? 'Titre et client requis' : 'Title and client required', false); return; }
    const body = {
      company: ctx.co(),
      titre,
      client: clientId,
      site: document.getElementById('ct-site')?.value || null,
      description: document.getElementById('ct-desc')?.value?.trim() || '',
      montant: parseFloat(document.getElementById('ct-montant')?.value) || 0,
      statut: document.getElementById('ct-statut')?.value || 'brouillon',
      date_debut: document.getElementById('ct-debut')?.value || null,
      date_fin: document.getElementById('ct-fin')?.value || null,
      created_by: ctx.uid(),
    };
    try {
      let id = editId;
      if (editId) await ctx.api('PATCH', `/api/collections/contrats/records/${editId}`, body);
      else {
        const created = await ctx.api('POST', '/api/collections/contrats/records', body);
        id = created.id;
      }
      await K().logActivity(ctx, { entityType: 'contrat', entityId: id, activity: editId ? 'updated' : 'created', message: titre });
      ctx.showToast(ctx.t('saved'));
      global.closeModal?.();
      render(ctx);
    } catch (e) { ctx.showToast(e.message, false); }
  }

  global.ChantierTrackContrats = { render, openCreate, openEdit, buildModal, save };
})(typeof window !== 'undefined' ? window : global);
