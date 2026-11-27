/**
 * JobsitePro — Soumissions : email client + convertir en chantier
 */
(function (global) {
  'use strict';

  const Tax = () => global.ChantierTrackCanadaTax;

  function laborMaterialSplit(phases) {
    let labor = 0;
    let materials = 0;
    for (const ph of phases || []) {
      for (const ln of ph.lignes || []) {
        if (ln.type === 'main_oeuvre') labor += (Number(ln.heures) || 0) * (Number(ln.taux) || 0);
        else materials += (Number(ln.quantite) || 0) * (Number(ln.prix_unitaire) || 0);
      }
    }
    return { labor, materials };
  }

  async function sendEmail(soumissionId, ctx) {
    const L = ctx.lang === 'fr';
    let rec;
    try {
      rec = await ctx.api('GET', `/api/collections/soumissions/records/${soumissionId}`);
    } catch (e) {
      ctx.showToast(e.message, false);
      return;
    }
    const email = (rec.client_email || '').trim();
    if (!email) {
      ctx.showToast(L ? 'Ajoutez l’email client sur la soumission' : 'Add client email on the quote', false);
      return;
    }
    const subject = encodeURIComponent(`${rec.numero || 'Soumission'} — ${rec.titre || rec.client_nom || 'JobsitePro'}`);
    const body = encodeURIComponent(
      (L ? 'Bonjour,\n\nVeuillez trouver ci-joint notre soumission.\n\n' : 'Hello,\n\nPlease find our quote attached.\n\n')
      + `${rec.titre || ''}\n`
      + `${L ? 'Montant TTC' : 'Total'}: ${(rec.montant_ttc || 0).toFixed(2)} $\n\n`
      + (L ? 'Cordialement' : 'Best regards')
    );
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
    if (rec.statut === 'brouillon') {
      try {
        await ctx.api('PATCH', `/api/collections/soumissions/records/${soumissionId}`, { statut: 'envoye', date_soumission: new Date().toISOString().slice(0, 10) });
      } catch { /* ignore */ }
    }
    ctx.showToast(L ? 'Courriel ouvert — joignez le PDF si besoin' : 'Email opened — attach PDF if needed');
    global.renderSoumissions?.();
  }

  async function convertToSite(soumissionId, ctx) {
    const L = ctx.lang === 'fr';
    const c = ctx.co();
    let rec;
    try {
      rec = await ctx.api('GET', `/api/collections/soumissions/records/${soumissionId}`);
    } catch (e) {
      ctx.showToast(e.message, false);
      return;
    }
    if (rec.site) {
      ctx.showToast(L ? 'Chantier déjà lié — ouvrez Coûts chantier' : 'Site already linked', false);
      global.closeModal?.();
      global.openJobCostsForSite?.(rec.site);
      return;
    }
    const { labor, materials } = laborMaterialSplit(rec.phases);
    const budget = Number(rec.montant_ttc) || Number(rec.montant_ht) || 0;
    const siteBody = {
      company: c,
      name: rec.titre || rec.client_nom || (L ? 'Nouveau chantier' : 'New site'),
      address: rec.adresse || '',
      status: 'active',
      progress: 0,
      budget,
      budget_labor: Math.round(labor * 100) / 100,
      budget_materials: Math.round(materials * 100) / 100,
      budget_expenses: 0,
      soumission: soumissionId,
    };
    try {
      const site = await ctx.api('POST', '/api/collections/sites/records', siteBody);
      await ctx.api('PATCH', `/api/collections/soumissions/records/${soumissionId}`, {
        site: site.id,
        statut: rec.statut === 'accepte' ? 'accepte' : 'accepte',
      });
      ctx.showToast(L ? 'Chantier créé et lié à la soumission' : 'Site created and linked');
      global.closeModal?.();
      global.localStorage?.setItem('jc_site_id', site.id);
      global.nav?.('couts-chantier');
    } catch (e) {
      ctx.showToast(e.message, false);
    }
  }

  global.ChantierTrackSoumissionsActions = {
    sendEmail: (id) => sendEmail(id, global.getPatronModuleCtx?.()),
    convertToSite: (id) => convertToSite(id, global.getPatronModuleCtx?.()),
  };
})(typeof window !== 'undefined' ? window : global);
