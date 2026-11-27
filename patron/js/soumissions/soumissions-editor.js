/**
 * JobsitePro — Éditeur soumissions (style Knowify)
 */
(function (global) {
  'use strict';

  const Tax = () => global.ChantierTrackCanadaTax;

  function newPhase(name) {
    return { id: 'ph_' + Date.now() + Math.random().toString(36).slice(2, 6), nom: name || '', lignes: [], sous_total_ht: 0 };
  }

  function newLine(type) {
    if (type === 'main_oeuvre') return { type: 'main_oeuvre', libelle: '', heures: 0, taux: 0 };
    return { type: 'materiau', libelle: '', quantite: 0, unite: 'u', prix_unitaire: 0 };
  }

  function defaultPhases(lang) {
    const L = lang === 'fr';
    return [
      newPhase(L ? 'Fondation' : 'Foundation'),
      newPhase(L ? 'Structure' : 'Structure'),
      newPhase(L ? 'Finition' : 'Finishing'),
    ];
  }

  function lineRowHtml(phIdx, lnIdx, ln, lang) {
    const L = lang === 'fr';
    if (ln.type === 'main_oeuvre') {
      return `<tr data-ph="${phIdx}" data-ln="${lnIdx}">
        <td><select class="ln-type" onchange="ChantierTrackSoumissionsEditor.onLineType(this,${phIdx},${lnIdx})"><option value="main_oeuvre" selected>${L ? 'Main-d\'œuvre' : 'Labor'}</option><option value="materiau">${L ? 'Matériaux' : 'Materials'}</option></select></td>
        <td><input class="ln-libelle" value="${ln.libelle || ''}" placeholder="${L ? 'Description' : 'Description'}"></td>
        <td><input class="ln-heures" type="number" step="0.5" min="0" value="${ln.heures || ''}" placeholder="h"></td>
        <td><input class="ln-taux" type="number" step="0.01" min="0" value="${ln.taux || ''}" placeholder="$/h"></td>
        <td colspan="2" style="text-align:right;font-weight:600" class="ln-sub">${((ln.heures || 0) * (ln.taux || 0)).toFixed(2)} $</td>
        <td><button type="button" class="btn btn-d btn-sm" onclick="ChantierTrackSoumissionsEditor.removeLine(${phIdx},${lnIdx})"><i class="ti ti-x"></i></button></td>
      </tr>`;
    }
    return `<tr data-ph="${phIdx}" data-ln="${lnIdx}">
      <td><select class="ln-type" onchange="ChantierTrackSoumissionsEditor.onLineType(this,${phIdx},${lnIdx})"><option value="main_oeuvre">${L ? 'Main-d\'œuvre' : 'Labor'}</option><option value="materiau" selected>${L ? 'Matériaux' : 'Materials'}</option></select></td>
      <td><input class="ln-libelle" value="${ln.libelle || ''}"></td>
      <td><input class="ln-qte" type="number" step="0.01" min="0" value="${ln.quantite || ''}"></td>
      <td><input class="ln-unite" value="${ln.unite || 'u'}" style="width:48px"></td>
      <td><input class="ln-pu" type="number" step="0.01" min="0" value="${ln.prix_unitaire || ''}" placeholder="$"></td>
      <td style="text-align:right;font-weight:600" class="ln-sub">${((ln.quantite || 0) * (ln.prix_unitaire || 0)).toFixed(2)} $</td>
      <td><button type="button" class="btn btn-d btn-sm" onclick="ChantierTrackSoumissionsEditor.removeLine(${phIdx},${lnIdx})"><i class="ti ti-x"></i></button></td>
    </tr>`;
  }

  function phasesHtml(phases, lang) {
    const L = lang === 'fr';
    return (phases || []).map((ph, pi) => `
      <div class="knowify-phase" data-ph="${pi}">
        <div class="knowify-phase-head">
          <input class="form-input ph-nom" value="${ph.nom || ''}" placeholder="${L ? 'Nom de la phase' : 'Phase name'}">
          <button type="button" class="btn btn-sm" onclick="ChantierTrackSoumissionsEditor.addLine(${pi})"><i class="ti ti-plus"></i></button>
          <button type="button" class="btn btn-d btn-sm" onclick="ChantierTrackSoumissionsEditor.removePhase(${pi})"><i class="ti ti-trash"></i></button>
        </div>
        <table class="knowify-lines"><thead><tr>
          <th>${L ? 'Type' : 'Type'}</th><th>${L ? 'Description' : 'Desc'}</th><th>${L ? 'Qté/h' : 'Qty/h'}</th><th>${L ? 'Unité' : 'Unit'}</th><th>${L ? 'Taux/prix' : 'Rate'}</th><th>${L ? 'Sous-total' : 'Sub'}</th><th></th>
        </tr></thead><tbody>${(ph.lignes || []).map((ln, li) => lineRowHtml(pi, li, ln, lang)).join('')}</tbody></table>
        <div style="text-align:right;font-size:12px;color:#94a3b8;margin-top:6px">${L ? 'Sous-total phase' : 'Phase sub'}: <strong class="ph-st">${(ph.sous_total_ht || 0).toFixed(2)} $</strong></div>
      </div>`).join('');
  }

  async function loadCompanySites(ctx) {
    const c = ctx.co();
    const filters = c ? [`company="${c}"`, ''] : [''];
    for (const f of filters) {
      try {
        const res = await ctx.apiList('sites', f, '', 'name', 200);
        const items = (res.items || []).filter(s => s?.id && s.name);
        if (items.length) {
          const loc = ctx.lang === 'fr' ? 'fr' : 'en';
          return items.sort((a, b) => String(a.name).localeCompare(String(b.name), loc, { sensitivity: 'base' }));
        }
      } catch { /* try next */ }
    }
    return [];
  }

  function applyClientFieldsFromSoumission(sou) {
    if (!sou) return;
    const set = (id, val) => { const el = document.getElementById(id); if (el && val != null && val !== '') el.value = val; };
    set('sou-client', sou.client_nom);
    set('sou-email', sou.client_email);
    set('sou-tel', sou.client_tel);
    if (sou.adresse) set('sou-adresse', sou.adresse);
    if (sou.province) {
      const prov = document.getElementById('sou-province');
      if (prov) prov.value = sou.province;
    }
  }

  async function onSiteChange(sel) {
    const siteId = typeof sel === 'string' ? sel : sel?.value;
    const editId = (typeof sel === 'object' && sel?.dataset?.editId) || document.getElementById('sou-site')?.dataset?.editId || '';
    if (!siteId) return;
    const ctx = global.getPatronModuleCtx?.();
    if (!ctx) return;
    const sites = global.__souSitesList || [];
    const cached = sites.find(s => s.id === siteId);
    const titre = document.getElementById('sou-titre');
    const adr = document.getElementById('sou-adresse');
    if (cached) {
      if (titre) titre.value = cached.name || '';
      if (adr) adr.value = cached.address || '';
    }
    try {
      let site = cached;
      try {
        site = await ctx.api('GET', `/api/collections/sites/records/${siteId}?expand=soumission`);
      } catch {
        site = await ctx.api('GET', `/api/collections/sites/records/${siteId}`);
      }
      if (titre) titre.value = site.name || titre?.value || '';
      if (adr) adr.value = site.address || adr?.value || '';
      const linked = site.expand?.soumission;
      if (linked?.id) {
        applyClientFieldsFromSoumission(linked);
      } else {
        const prev = await ctx.apiList('soumissions', `site="${siteId}"`, '', '-created', 3);
        const last = (prev.items || []).find(s => !editId || s.id !== editId);
        if (last) {
          applyClientFieldsFromSoumission(last);
          if (!editId && last.phases?.length && document.getElementById('sou-phases')) {
            document.getElementById('sou-phases').innerHTML = phasesHtml(last.phases, ctx.lang || 'fr');
          }
        }
      }
      recalcTotals();
    } catch (e) {
      console.warn('onSiteChange', e);
    }
  }

  async function buildModalHtml(ctx, editId) {
    const { api, apiList, co, lang, uid, fmtMoney } = ctx;
    const L = lang === 'fr';
    let rec = null;
    if (editId) {
      try { rec = await api('GET', `/api/collections/soumissions/records/${editId}?expand=site`); } catch { /* ignore */ }
    }
    const sites = await loadCompanySites(ctx);
    global.__souSitesList = sites;
    let comp = {};
    try { comp = await api('GET', `/api/collections/companies/records/${co()}`); } catch { /* ignore */ }
    const province = rec?.province || comp.tax_province || comp.province || 'QC';
    const phases = rec?.phases?.length ? rec.phases : defaultPhases(lang);
    const totals = Tax()?.calcFromPhases(JSON.parse(JSON.stringify(phases)), province) || {};
    const selectedSite = rec?.site || '';
    const siteOpts = sites.map(s => {
      const sel = selectedSite === s.id ? ' selected' : '';
      return `<option value="${s.id}"${sel}>${(s.name || '').replace(/</g, '&lt;')}</option>`;
    }).join('');

    return `<div class="modal-header fin-module" style="max-width:920px;width:95vw">
      <span class="modal-title">${rec ? (L ? 'Modifier soumission' : 'Edit quote') : (L ? 'Nouvelle soumission' : 'New quote')}</span>
      <button class="btn btn-sm" onclick="closeModal()"><i class="ti ti-x"></i></button>
    </div>
    <div class="fin-module" style="max-height:75vh;overflow-y:auto;padding:0 4px">
      <div class="form-group" style="margin-bottom:10px">
        <label class="form-label">${L ? 'Projet / chantier' : 'Project / site'} *</label>
        <select class="form-input" id="sou-site" data-edit-id="${editId || ''}" onchange="ChantierTrackSoumissionsEditor.onSiteChange(this)">
          <option value="">${L ? '— Choisir un projet —' : '— Select a project —'}</option>
          ${siteOpts}
        </select>
        <p style="font-size:11px;color:#94a3b8;margin-top:4px">${L ? 'Les champs ci-dessous se remplissent automatiquement selon le projet.' : 'Fields below auto-fill from the selected project.'}</p>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="form-group"><label class="form-label">${L ? 'Titre projet' : 'Project title'}</label><input class="form-input" id="sou-titre" value="${rec?.titre || rec?.expand?.site?.name || ''}"></div>
        <div class="form-group"><label class="form-label">${L ? 'Province' : 'Province'}</label><select class="form-input" id="sou-province" onchange="ChantierTrackSoumissionsEditor.recalcTotals()">${Tax()?.provinceSelectHtml('sou-province', province, lang)}</select></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
        <div class="form-group"><label class="form-label">${L ? 'Client' : 'Client'}</label><input class="form-input" id="sou-client" value="${rec?.client_nom || ''}"></div>
        <div class="form-group"><label class="form-label">Email</label><input class="form-input" id="sou-email" type="email" value="${rec?.client_email || ''}"></div>
        <div class="form-group"><label class="form-label">${L ? 'Téléphone' : 'Phone'}</label><input class="form-input" id="sou-tel" value="${rec?.client_tel || ''}"></div>
      </div>
      <div class="form-group"><label class="form-label">${L ? 'Adresse chantier' : 'Site address'}</label><input class="form-input" id="sou-adresse" value="${rec?.adresse || rec?.expand?.site?.address || ''}"></div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin:12px 0 8px">
        <strong style="font-size:13px;color:#f1f5f9">${L ? 'Phases du projet' : 'Project phases'}</strong>
        <button type="button" class="btn btn-sm" onclick="ChantierTrackSoumissionsEditor.addPhase()"><i class="ti ti-plus"></i> ${L ? 'Phase' : 'Phase'}</button>
      </div>
      <div class="knowify-phases" id="sou-phases">${phasesHtml(phases, lang)}</div>
      <div class="knowify-totals" id="sou-totals">
        <div class="knowify-totals-row"><span>${L ? 'Sous-total HT' : 'Subtotal'}</span><span id="sou-ht">${fmtMoney(totals.montant_ht)}</span></div>
        <div class="knowify-totals-row"><span id="sou-tax-lbl">${totals.tax_label || 'Tax'}</span><span id="sou-tax">${fmtMoney((totals.montant_tps || 0) + (totals.montant_tvq || 0))}</span></div>
        <div class="knowify-totals-row grand"><span>Total TTC</span><span id="sou-ttc">${fmtMoney(totals.montant_ttc)}</span></div>
      </div>
      <div class="form-group" style="margin-top:10px"><label class="form-label">${L ? 'Notes' : 'Notes'}</label><textarea class="form-input" id="sou-notes" rows="2">${rec?.notes || ''}</textarea></div>
    </div>
    <div class="modal-footer" style="flex-wrap:wrap;gap:6px">
      <button class="btn" onclick="closeModal()">${L ? 'Annuler' : 'Cancel'}</button>
      ${rec?.statut === 'accepte' && rec?.site ? `<button class="btn btn-g" type="button" onclick="ChantierTrackSoumissionsEditor.goSite('${rec.site}')"><i class="ti ti-chart-pie"></i> ${L ? 'Coûts' : 'Costs'}</button>` : ''}
      ${rec && !rec.site ? `<button class="btn btn-g" type="button" onclick="ChantierTrackSoumissionsActions.convertToSite('${editId}')"><i class="ti ti-building"></i> ${L ? 'Convertir en chantier' : 'Convert to site'}</button>` : ''}
      <button class="btn btn-p" onclick="ChantierTrackSoumissionsEditor.save('${editId || ''}')">${L ? 'Enregistrer' : 'Save'}</button>
      ${rec ? `<button class="btn btn-sm" onclick="ChantierTrackSoumissionsEditor.pdf('${editId}')"><i class="ti ti-file-pdf"></i> PDF</button>` : ''}
      ${rec ? `<button class="btn btn-sm" onclick="ChantierTrackSoumissionsActions.sendEmail('${editId}')"><i class="ti ti-mail"></i> ${L ? 'Email' : 'Email'}</button>` : ''}
    </div>`;
  }

  function readPhasesFromDom() {
    const phases = [];
    document.querySelectorAll('.knowify-phase').forEach((phEl, pi) => {
      const nom = phEl.querySelector('.ph-nom')?.value || '';
      const lignes = [];
      phEl.querySelectorAll('tbody tr').forEach(tr => {
        const type = tr.querySelector('.ln-type')?.value || 'materiau';
        const libelle = tr.querySelector('.ln-libelle')?.value || '';
        if (type === 'main_oeuvre') {
          lignes.push({
            type, libelle,
            heures: parseFloat(tr.querySelector('.ln-heures')?.value) || 0,
            taux: parseFloat(tr.querySelector('.ln-taux')?.value) || 0,
          });
        } else {
          lignes.push({
            type: 'materiau', libelle,
            quantite: parseFloat(tr.querySelector('.ln-qte')?.value) || 0,
            unite: tr.querySelector('.ln-unite')?.value || 'u',
            prix_unitaire: parseFloat(tr.querySelector('.ln-pu')?.value) || 0,
          });
        }
      });
      phases.push({ id: 'ph' + pi, nom, lignes, sous_total_ht: 0 });
    });
    return phases;
  }

  function recalcTotals() {
    const province = document.getElementById('sou-province')?.value || 'QC';
    const phases = readPhasesFromDom();
    const t = Tax()?.calcFromPhases(phases, province);
    if (!t) return;
    const fmt = v => (v || 0).toFixed(2) + ' $';
    const ht = document.getElementById('sou-ht');
    const tax = document.getElementById('sou-tax');
    const ttc = document.getElementById('sou-ttc');
    const lbl = document.getElementById('sou-tax-lbl');
    if (ht) ht.textContent = fmt(t.montant_ht);
    if (tax) tax.textContent = fmt(t.montant_tps + t.montant_tvq);
    if (ttc) ttc.textContent = fmt(t.montant_ttc);
    if (lbl) lbl.textContent = t.tax_label;
    document.querySelectorAll('.knowify-phase').forEach((phEl, i) => {
      const st = phases[i]?.sous_total_ht || 0;
      const el = phEl.querySelector('.ph-st');
      if (el) el.textContent = st.toFixed(2) + ' $';
    });
  }

  function bindInputRecalc() {
    document.getElementById('modal-content')?.addEventListener('input', e => {
      if (e.target.closest('.knowify-phase')) recalcTotals();
    });
  }

  function addPhase() {
    const host = document.getElementById('sou-phases');
    if (!host) return;
    const lang = global.lang || 'fr';
    const phases = readPhasesFromDom();
    phases.push(newPhase(lang === 'fr' ? 'Nouvelle phase' : 'New phase'));
    host.innerHTML = phasesHtml(phases, lang);
    recalcTotals();
  }

  function removePhase(pi) {
    const phases = readPhasesFromDom();
    phases.splice(pi, 1);
    const host = document.getElementById('sou-phases');
    if (host) host.innerHTML = phasesHtml(phases, global.lang || 'fr');
    recalcTotals();
  }

  function addLine(pi) {
    const phases = readPhasesFromDom();
    if (!phases[pi]) return;
    if (!phases[pi].lignes) phases[pi].lignes = [];
    phases[pi].lignes.push(newLine('materiau'));
    document.getElementById('sou-phases').innerHTML = phasesHtml(phases, global.lang || 'fr');
    recalcTotals();
  }

  function removeLine(pi, li) {
    const phases = readPhasesFromDom();
    phases[pi]?.lignes?.splice(li, 1);
    document.getElementById('sou-phases').innerHTML = phasesHtml(phases, global.lang || 'fr');
    recalcTotals();
  }

  function onLineType(sel, pi, li) {
    const phases = readPhasesFromDom();
    phases[pi].lignes[li] = newLine(sel.value);
    document.getElementById('sou-phases').innerHTML = phasesHtml(phases, global.lang || 'fr');
    recalcTotals();
  }

  async function save(editId, ctx) {
    const c = ctx.co();
    const province = document.getElementById('sou-province')?.value || 'QC';
    const phases = readPhasesFromDom();
    const totals = Tax()?.calcFromPhases(phases, province);
    const siteId = document.getElementById('sou-site')?.value?.trim() || '';
    const body = {
      company: c,
      created_by: ctx.uid(),
      site: siteId || null,
      titre: document.getElementById('sou-titre')?.value.trim(),
      client_nom: document.getElementById('sou-client')?.value.trim(),
      client_email: document.getElementById('sou-email')?.value.trim(),
      client_tel: document.getElementById('sou-tel')?.value.trim(),
      adresse: document.getElementById('sou-adresse')?.value.trim(),
      province,
      phases,
      montant_ht: totals?.montant_ht || 0,
      montant_tps: totals?.montant_tps || 0,
      montant_tvq: totals?.montant_tvq || 0,
      montant_ttc: totals?.montant_ttc || 0,
      statut: 'brouillon',
      notes: document.getElementById('sou-notes')?.value.trim(),
    };
    if (!siteId) {
      ctx.showToast(ctx.lang === 'fr' ? 'Choisissez un projet / chantier' : 'Select a project / site', false);
      return;
    }
    if (!body.titre || !body.client_nom) {
      ctx.showToast(ctx.lang === 'fr' ? 'Titre et client requis' : 'Title and client required', false);
      return;
    }
    try {
      if (editId) await ctx.api('PATCH', `/api/collections/soumissions/records/${editId}`, body);
      else await ctx.api('POST', '/api/collections/soumissions/records', body);
      ctx.showToast(ctx.t('saved'));
      global.closeModal?.();
      global.renderSoumissions?.();
    } catch (e) {
      ctx.showToast(e.message, false);
    }
  }

  function pdf(id) {
    const ctx = global.getPatronModuleCtx?.();
    if (global.ChantierTrackSoumissionsPdf && ctx) {
      ChantierTrackSoumissionsPdf.generatePdf(id, ctx);
    } else {
      ctxShowToast(global.lang === 'fr' ? 'Module PDF non chargé' : 'PDF module missing', false);
    }
  }

  function goSite(siteId) {
    global.closeModal?.();
    global.localStorage?.setItem('jc_site_id', siteId);
    global.nav?.('couts-chantier');
  }

  function ctxShowToast(msg) { global.showToast?.(msg); }

  global.ChantierTrackSoumissionsEditor = {
    buildModalHtml,
    bindInputRecalc,
    recalcTotals,
    onSiteChange,
    addPhase,
    removePhase,
    addLine,
    removeLine,
    onLineType,
    save: (id) => save(id, global.getPatronModuleCtx()),
    pdf,
    goSite,
  };
})(typeof window !== 'undefined' ? window : global);
