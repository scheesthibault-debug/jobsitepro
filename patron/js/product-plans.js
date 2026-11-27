/**
 * JobsitePro — Forfaits / modules par entreprise (companies.plan)
 *
 * Règle métier : TERRAIN = GPS + pointage + documents sécurité (liés).
 * Pas de signature des docs SST → pas de pointage (déjà côté app + hook PB).
 *
 * FINANCES = reçus OCR + dépenses (add-on, séparé du terrain).
 */
(function (global) {
  'use strict';

  /** Alias anciens noms PocketBase → clé interne */
  const PLAN_ALIASES = {
    basic: 'terrain',
    terrain: 'terrain',
    standard: 'terrain',
    documents: 'finances',
    finances: 'finances',
    pro: 'pro',
    premium: 'pro',
    enterprise: 'enterprise',
    elite: 'enterprise',
    élite: 'enterprise',
    complet: 'enterprise',
  };

  /** Modules inclus par forfait (terrain inclut toujours docs sécurité + GPS) */
  const PLAN_MODULES = {
    terrain: new Set(['terrain']),
    finances: new Set(['terrain', 'finances']),
    pro: new Set(['terrain', 'finances']),
    enterprise: new Set(['terrain', 'finances', 'entreprise']),
  };

  /** Pages patron → module requis */
  const PATRON_PAGE_MODULE = {
    dashboard: 'terrain',
    chantiers: 'terrain',
    affectations: 'terrain',
    pointages: 'terrain',
    employes: 'terrain',
    horaires: 'terrain',
    conges: 'terrain',
    documents: 'terrain',
    photos: 'terrain',
    travaux: 'terrain',
    probleme: 'terrain',
    incidents: 'terrain',
    carte: 'terrain',
    depenses: 'finances',
    kilometrage: 'finances',
    facturation: 'finances',
    clients: 'entreprise',
    prospects: 'entreprise',
    factures: 'entreprise',
    journal: 'entreprise',
    tickets: 'entreprise',
    contrats: 'entreprise',
    planning: 'entreprise',
    paie: 'entreprise',
    backup: 'entreprise',
    soumissions: 'entreprise',
    'couts-chantier': 'entreprise',
    activite: 'entreprise',
    rentabilite: 'entreprise',
    rapports: 'entreprise',
    quickbooks: 'entreprise',
    wagepoint: 'entreprise',
    parametres: 'terrain',
  };

  /** Onglets / écrans employé → module */
  const EMPLOYEE_TAB_MODULE = {
    home: 'terrain',
    clock: 'terrain',
    docs: 'terrain',
    photos: 'terrain',
    incident: 'terrain',
    notifications: 'terrain',
    settings: 'terrain',
    expense: 'finances',
    km: 'finances',
    pay: 'entreprise',
    leave: 'terrain',
  };

  /** Boutons accueil employé (quick-btn) */
  const EMPLOYEE_HOME_FEATURE = {
    'home-docs-lbl': 'terrain',
    'home-photos-lbl': 'terrain',
    'home-expense-lbl': 'finances',
    'home-km-lbl': 'finances',
    'home-pay-lbl': 'entreprise',
    'home-leave-lbl': 'terrain',
    'home-notif-lbl': 'terrain',
  };

  function normalizePlan(raw) {
    const key = String(raw || 'terrain').toLowerCase().trim();
    return PLAN_ALIASES[key] || key;
  }

  function getCompanyPlan(user) {
    const fromExpand = user?.expand?.company?.plan;
    const fromFlat = user?.company_plan;
    return normalizePlan(fromExpand || fromFlat || 'terrain');
  }

  function planModules(planKey) {
    const p = normalizePlan(planKey);
    return PLAN_MODULES[p] || PLAN_MODULES.terrain;
  }

  function hasModule(user, moduleName) {
    const mods = planModules(getCompanyPlan(user));
    return mods.has(moduleName);
  }

  function canAccessPatronPageByPlan(user, pageId) {
    const mod = PATRON_PAGE_MODULE[pageId];
    if (!mod) return true;
    return hasModule(user, mod);
  }

  function canAccessEmployeeTabByPlan(user, tabName) {
    const mod = EMPLOYEE_TAB_MODULE[tabName];
    if (!mod) return true;
    return hasModule(user, mod);
  }

  function planLabel(planKey, lang) {
    const p = normalizePlan(planKey);
    const fr = {
      terrain: 'Standard',
      finances: 'Premium',
      pro: 'Premium',
      enterprise: 'Élite',
    };
    const en = {
      terrain: 'Standard',
      finances: 'Premium',
      pro: 'Premium',
      enterprise: 'Elite',
    };
    const L = lang === 'en' ? en : fr;
    return L[p] || p;
  }

  /** Masque les libellés de section sans entrée visible */
  function applyPatronNavByPlan(user) {
    document.querySelectorAll('.nav-label').forEach((label) => {
      let next = label.nextElementSibling;
      let anyVisible = false;
      while (next && !next.classList.contains('nav-label')) {
        if (next.classList.contains('nav-item') && next.style.display !== 'none') {
          anyVisible = true;
          break;
        }
        next = next.nextElementSibling;
      }
      label.style.display = anyVisible ? '' : 'none';
    });
  }

  /** Masque onglets employé + raccourcis accueil */
  function applyEmployeeUiByPlan(user) {
    Object.keys(EMPLOYEE_TAB_MODULE).forEach((tab) => {
      const el = document.getElementById('tab-' + tab);
      if (!el) return;
      el.style.display = canAccessEmployeeTabByPlan(user, tab) ? '' : 'none';
    });
    Object.entries(EMPLOYEE_HOME_FEATURE).forEach(([lblId, mod]) => {
      const lbl = document.getElementById(lblId);
      const quick = lbl?.closest('.quick-btn');
      if (quick) quick.style.display = hasModule(user, mod) ? '' : 'none';
    });
    const homeClock = document.getElementById('home-clock-btn');
    if (homeClock && !hasModule(user, 'terrain')) {
      homeClock.style.display = 'none';
    }
  }

  function guardEmployeeTab(user, tabName, lang) {
    if (canAccessEmployeeTabByPlan(user, tabName)) return true;
    const L = lang === 'en' ? 'en' : 'fr';
    const msg =
      L === 'fr'
        ? 'Fonction non incluse dans le forfait de votre entreprise.'
        : 'Feature not included in your company plan.';
    global.showToast?.(msg, false);
    return false;
  }

  global.ChantierTrackProductPlans = {
    normalizePlan,
    getCompanyPlan,
    hasModule,
    canAccessPatronPageByPlan,
    canAccessEmployeeTabByPlan,
    planLabel,
    applyPatronNavByPlan,
    applyEmployeeUiByPlan,
    guardEmployeeTab,
    PLAN_MODULES,
  };
})(typeof window !== 'undefined' ? window : global);
