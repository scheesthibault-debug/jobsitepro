/**
 * ChantierTrack — Configuration provinciale paie Canada (2025)
 * Logique pure, sans React. Utilisé par payroll-engine.js
 *
 * TODO: Intégrer les tables d'imposition réelles ARC / Revenu Québec (paliers progressifs).
 * Les taux prov/féd actuels sont des estimations (1er palier / taux fixe).
 */
(function (global) {
  'use strict';

  /** @typedef {'AB'|'BC'|'MB'|'NB'|'NL'|'NS'|'NT'|'NU'|'ON'|'PE'|'QC'|'SK'|'YT'} ProvinceCode */

  const FEDERAL = {
    cpp: { empRate: 0.0595, erRate: 0.0595, maxEarnings: 71300, basicExemption: 3500 },
    rrq: { empRate: 0.067, erRate: 0.067, maxEarnings: 73200, basicExemption: 3500 },
    ei: { empRate: 0.0164, erFactor: 1.4, maxInsurable: 65700 },
    eiQC: { empRate: 0.0132, erFactor: 1.4, maxInsurable: 65700 },
    rqap: { empRate: 0.00494, erRate: 0.00692, maxInsurable: 94000 },
    // TODO: tables fédérales réelles
    fedRateDefault: 0.15,
    fedQcAbatement: 0.165,
  };

  /** Provinces détaillées — NS et QC documentées pour le MVP */
  const PROVINCE_RULES = {
    NS: {
      code: 'NS',
      fr: 'Nouvelle-Écosse',
      en: 'Nova Scotia',
      provRate: 0.0879,
      // TODO: crédits d'impôt NS, paliers NS
      notes: { fr: 'Taux prov. estimé — valider avec comptable', en: 'Est. prov. rate — confirm with accountant' },
    },
    QC: {
      code: 'QC',
      fr: 'Québec',
      en: 'Quebec',
      provRate: 0.14,
      usesRRQ: true,
      usesRQAP: true,
      // TODO: TP-1015.3, tables RQ
      notes: { fr: 'RRQ + RQAP + impôt QC — estimation', en: 'QPP + QPIP + QC tax — estimate' },
    },
    ON: { code: 'ON', fr: 'Ontario', en: 'Ontario', provRate: 0.0505 },
    AB: { code: 'AB', fr: 'Alberta', en: 'Alberta', provRate: 0.10 },
    BC: { code: 'BC', fr: 'Colombie-Britannique', en: 'British Columbia', provRate: 0.0506 },
    MB: { code: 'MB', fr: 'Manitoba', en: 'Manitoba', provRate: 0.108 },
    NB: { code: 'NB', fr: 'Nouveau-Brunswick', en: 'New Brunswick', provRate: 0.094 },
    NL: { code: 'NL', fr: 'Terre-Neuve', en: 'Newfoundland', provRate: 0.087 },
    NT: { code: 'NT', fr: 'T.N.-O.', en: 'NWT', provRate: 0.059 },
    NU: { code: 'NU', fr: 'Nunavut', en: 'Nunavut', provRate: 0.04 },
    PE: { code: 'PE', fr: 'Î.-P.-É.', en: 'PEI', provRate: 0.0965 },
    SK: { code: 'SK', fr: 'Saskatchewan', en: 'Saskatchewan', provRate: 0.105 },
    YT: { code: 'YT', fr: 'Yukon', en: 'Yukon', provRate: 0.064 },
  };

  /** Fallback fédéral / générique */
  const GENERIC = {
    code: 'GENERIC',
    fr: 'Canada (générique)',
    en: 'Canada (generic)',
    provRate: 0.10,
    notes: { fr: 'Province non configurée — taux indicatif', en: 'Unconfigured province — indicative rate' },
  };

  function getProvinceRule(code) {
    return PROVINCE_RULES[code] || GENERIC;
  }

  /** Compatibilité avec l’ancien objet CA_PAY dans patron/index.html */
  const CA_PAY = {
    cpp: FEDERAL.cpp,
    rrq: FEDERAL.rrq,
    ei: FEDERAL.ei,
    eiQC: FEDERAL.eiQC,
    rqap: FEDERAL.rqap,
    provinces: Object.fromEntries(
      Object.entries(PROVINCE_RULES).map(([k, p]) => [k, { fr: p.fr, en: p.en, provRate: p.provRate }])
    ),
  };

  global.ChantierTrackPayrollConfig = {
    FEDERAL,
    PROVINCE_RULES,
    GENERIC,
    CA_PAY,
    getProvinceRule,
  };
})(typeof window !== 'undefined' ? window : global);
