/**
 * Taxes de vente Canada (soumissions / factures)
 */
(function (global) {
  'use strict';

  /** @typedef {{ gst: number, pst: number, hst: number, label: string }} TaxProfile */

  const PROFILES = {
    QC: { gst: 0.05, pst: 0.09975, hst: 0, label: 'TPS 5% + TVQ 9,975%' },
    ON: { gst: 0, pst: 0, hst: 0.13, label: 'HST 13%' },
    NB: { gst: 0, pst: 0, hst: 0.15, label: 'HST 15%' },
    NL: { gst: 0, pst: 0, hst: 0.15, label: 'HST 15%' },
    NS: { gst: 0, pst: 0, hst: 0.14, label: 'HST 14%' },
    PE: { gst: 0, pst: 0, hst: 0.15, label: 'HST 15%' },
    BC: { gst: 0.05, pst: 0.07, hst: 0, label: 'GST 5% + PST 7%' },
    SK: { gst: 0.05, pst: 0.06, hst: 0, label: 'GST 5% + PST 6%' },
    MB: { gst: 0.05, pst: 0.07, hst: 0, label: 'GST 5% + RST 7%' },
    AB: { gst: 0.05, pst: 0, hst: 0, label: 'GST 5%' },
    NT: { gst: 0.05, pst: 0, hst: 0, label: 'GST 5%' },
    NU: { gst: 0.05, pst: 0, hst: 0, label: 'GST 5%' },
    YT: { gst: 0.05, pst: 0, hst: 0, label: 'GST 5%' },
  };

  const PROVINCE_OPTIONS = Object.keys(PROFILES);

  function getProfile(province) {
    return PROFILES[province] || PROFILES.AB;
  }

  function calcFromPhases(phases, province) {
    let ht = 0;
    for (const ph of phases || []) {
      let st = 0;
      for (const ln of ph.lignes || []) {
        if (ln.type === 'main_oeuvre') st += (Number(ln.heures) || 0) * (Number(ln.taux) || 0);
        else st += (Number(ln.quantite) || 0) * (Number(ln.prix_unitaire) || 0);
      }
      ph.sous_total_ht = Math.round(st * 100) / 100;
      ht += ph.sous_total_ht;
    }
    ht = Math.round(ht * 100) / 100;
    const p = getProfile(province);
    let gstAmt = 0;
    let pstAmt = 0;
    let hstAmt = 0;
    if (p.hst > 0) {
      hstAmt = Math.round(ht * p.hst * 100) / 100;
    } else {
      gstAmt = Math.round(ht * p.gst * 100) / 100;
      pstAmt = Math.round(ht * p.pst * 100) / 100;
    }
    const ttc = Math.round((ht + gstAmt + pstAmt + hstAmt) * 100) / 100;
    return {
      montant_ht: ht,
      montant_tps: p.hst > 0 ? hstAmt : gstAmt,
      montant_tvq: pstAmt,
      montant_hst: hstAmt,
      montant_ttc: ttc,
      tax_label: p.label,
    };
  }

  function calcFromAmount(ht, province) {
    ht = Math.round((Number(ht) || 0) * 100) / 100;
    const p = getProfile(province);
    let gstAmt = 0;
    let pstAmt = 0;
    let hstAmt = 0;
    if (p.hst > 0) {
      hstAmt = Math.round(ht * p.hst * 100) / 100;
    } else {
      gstAmt = Math.round(ht * p.gst * 100) / 100;
      pstAmt = Math.round(ht * p.pst * 100) / 100;
    }
    const ttc = Math.round((ht + gstAmt + pstAmt + hstAmt) * 100) / 100;
    return {
      montant_ht: ht,
      montant_tps: p.hst > 0 ? hstAmt : gstAmt,
      montant_tvq: pstAmt,
      montant_hst: hstAmt,
      montant_ttc: ttc,
      tax_label: p.label,
    };
  }

  function provinceSelectHtml(id, selected, lang) {
    const cfg = global.ChantierTrackPayrollConfig?.PROVINCE_RULES || {};
    return PROVINCE_OPTIONS.map(code => {
      const name = lang === 'fr' ? (cfg[code]?.fr || code) : (cfg[code]?.en || code);
      return `<option value="${code}" ${code === selected ? 'selected' : ''}>${code} — ${name}</option>`;
    }).join('');
  }

  global.ChantierTrackCanadaTax = {
    PROFILES,
    PROVINCE_OPTIONS,
    getProfile,
    calcFromPhases,
    calcFromAmount,
    provinceSelectHtml,
  };
})(typeof window !== 'undefined' ? window : global);
