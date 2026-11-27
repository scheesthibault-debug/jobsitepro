/**
 * JobsitePro — Work Orders (Knowify)
 */
(function (global) {
  'use strict';

  const K = () => global.ChantierTrackKnowify;

  const STATUT = {
    fr: { ouvert: 'Ouvert', planifie: 'Planifié', en_cours: 'En cours', termine: 'Terminé', annule: 'Annulé' },
    en: { ouvert: 'Open', planifie: 'Scheduled', en_cours: 'In progress', termine: 'Done', annule: 'Cancelled' },
  };
  const PRIO = { basse: '#64748b', normale: '#378add', haute: '#f59e0b', urgente: '#f87171' };

  async function render(ctx) {
    const host = document.getElementById('tickets-root');
    if (!host) return;
    const L = ctx.lang === 'fr';
    const c = ctx.co();
    let list = [];
    try {
      const res = await ctx.apiList('service_tickets', `company="${c}"`, 'client,site,assigne_a', '-created', 200);
      list = res.items || [];
    } catch {
      host.innerHTML = K().missingCollectionHtml(ctx.lang, 'Work Orders');
      return;
    }
    const open = list.filter(t => !['termine', 'annule'].includes(t.statut)).length;
    host.innerHTML = `<div class="fin-module">
      <div class="fin-hero"><h2>Work Orders</h2><p>${L ? 'Interventions courtes et SAV' : 'Short jobs and service calls'}</p></div>
      <button class="btn btn-p" style="margin-bottom:14px" onclick="ChantierTrackTickets.openCreate()"><i class="ti ti-plus"></i> New work order</button>
      <div class="fin-kpi-row"><div class="fin-kpi"><div class="fin-kpi-lbl">${L ? 'Ouverts' : 'Open'}</div><div class="fin-kpi-val accent">${open}</div></div></div>
      <div class="dext-gallery"><table class="knowify-lines"><thead><tr>
        <th>${L ? 'Titre' : 'Title'}</th><th>Client</th><th>${L ? 'Priorité' : 'Priority'}</th><th>${L ? 'Statut' : 'Status'}</th><th>${L ? 'Assigné' : 'Assigned'}</th><th></th>
      </tr></thead><tbody>
      ${list.length ? list.map(t => `<tr>
        <td style="font-weight:600">${t.titre}</td>
        <td style="font-size:12px">${t.expand?.client?.nom || '–'}</td>
        <td>${K().badge(t.priorite || 'normale', PRIO[t.priorite] || '#378add')}</td>
        <td>${K().badge((STATUT[ctx.lang] || STATUT.fr)[t.statut] || t.statut, '#64748b')}</td>
        <td style="font-size:12px">${t.expand?.assigne_a?.name || '–'}</td>
        <td><button class="btn btn-sm" onclick="ChantierTrackTickets.openEdit('${t.id}')"><i class="ti ti-edit"></i></button></td>
      </tr>`).join('') : `<tr><td colspan="6" style="text-align:center;padding:32px;color:#64748b">${L ? 'Aucun ticket' : 'No tickets'}</td></tr>`}
      </tbody></table></div>
    </div>`;
  }

  function openCreate() { global.openModal?.('ticket'); }
  function openEdit(id) { global.openModal?.('ticket', id); }

  async function buildModal(ctx, editId) {
    const L = ctx.lang === 'fr';
    let rec = null;
    if (editId) try { rec = await ctx.api('GET', `/api/collections/service_tickets/records/${editId}`); } catch { /* */ }
    const [clients, sites, emps] = await Promise.all([K().loadClients(ctx), K().loadSites(ctx), K().loadEmployees(ctx)]);
    const v = k => rec?.[k] ?? '';
    const stOpts = Object.keys(STATUT.fr).map(s => `<option value="${s}" ${v('statut') === s ? 'selected' : ''}>${(STATUT[ctx.lang] || STATUT.fr)[s]}</option>`).join('');
    const prOpts = ['basse', 'normale', 'haute', 'urgente'].map(p => `<option value="${p}" ${(v('priorite') || 'normale') === p ? 'selected' : ''}>${p}</option>`).join('');
    return K().modalShell(
      editId ? 'Work order' : 'New work order',
      `<div class="form-group"><label class="form-label">${L ? 'Titre' : 'Title'} *</label><input class="form-input" id="tk-titre" value="${v('titre')}"></div>
       <div class="form-group"><label class="form-label">${L ? 'Description' : 'Description'}</label><textarea class="form-input" id="tk-desc" rows="2">${v('description')}</textarea></div>
       <div class="two-col"><div class="form-group"><label class="form-label">Client</label><select class="form-input" id="tk-client"><option value="">—</option>${clients.map(cl => `<option value="${cl.id}" ${rec?.client === cl.id ? 'selected' : ''}>${cl.nom}</option>`).join('')}</select></div>
       <div class="form-group"><label class="form-label">${L ? 'Chantier' : 'Site'}</label><select class="form-input" id="tk-site"><option value="">—</option>${sites.map(s => `<option value="${s.id}" ${rec?.site === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}</select></div></div>
       <div class="two-col"><div class="form-group"><label class="form-label">${L ? 'Priorité' : 'Priority'}</label><select class="form-input" id="tk-prio">${prOpts}</select></div>
       <div class="form-group"><label class="form-label">${L ? 'Statut' : 'Status'}</label><select class="form-input" id="tk-statut">${stOpts}</select></div></div>
       <div class="two-col"><div class="form-group"><label class="form-label">${L ? 'Assigné à' : 'Assigned'}</label><select class="form-input" id="tk-assign"><option value="">—</option>${emps.map(e => `<option value="${e.id}" ${rec?.assigne_a === e.id ? 'selected' : ''}>${e.name || e.email}</option>`).join('')}</select></div>
       <div class="form-group"><label class="form-label">${L ? 'Date planifiée' : 'Scheduled'}</label><input class="form-input" id="tk-date" type="date" value="${v('date_planifiee') || ''}"></div></div>`,
      `<button class="btn" onclick="closeModal()">${L ? 'Annuler' : 'Cancel'}</button>
       <button class="btn btn-p" onclick="ChantierTrackTickets.save('${editId || ''}')">${L ? 'Enregistrer' : 'Save'}</button>`
    );
  }

  async function save(editId) {
    const ctx = global.getPatronModuleCtx?.();
    if (!ctx) return;
    const L = ctx.lang === 'fr';
    const titre = document.getElementById('tk-titre')?.value?.trim();
    if (!titre) { ctx.showToast(L ? 'Titre requis' : 'Title required', false); return; }
    const body = {
      company: ctx.co(),
      titre,
      description: document.getElementById('tk-desc')?.value?.trim() || '',
      client: document.getElementById('tk-client')?.value || null,
      site: document.getElementById('tk-site')?.value || null,
      priorite: document.getElementById('tk-prio')?.value || 'normale',
      statut: document.getElementById('tk-statut')?.value || 'ouvert',
      assigne_a: document.getElementById('tk-assign')?.value || null,
      date_planifiee: document.getElementById('tk-date')?.value || null,
      created_by: ctx.uid(),
    };
    try {
      let id = editId;
      if (editId) await ctx.api('PATCH', `/api/collections/service_tickets/records/${editId}`, body);
      else {
        const created = await ctx.api('POST', '/api/collections/service_tickets/records', body);
        id = created.id;
      }
      await K().logActivity(ctx, { entityType: 'ticket', entityId: id, activity: editId ? 'updated' : 'created', message: titre });
      ctx.showToast(ctx.t('saved'));
      global.closeModal?.();
      render(ctx);
    } catch (e) { ctx.showToast(e.message, false); }
  }

  global.ChantierTrackTickets = { render, openCreate, openEdit, buildModal, save };
})(typeof window !== 'undefined' ? window : global);
