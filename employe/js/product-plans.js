/**
 * JobsitePro — Forfaits (copie partagée patron / employé)
 * @see patron/js/product-plans.js
 */
(function (global) {
  'use strict';
  if (global.ChantierTrackProductPlans) return;

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

  const PLAN_MODULES = {
    terrain: new Set(['terrain']),
    finances: new Set(['terrain', 'finances']),
    pro: new Set(['terrain', 'finances']),
    enterprise: new Set(['terrain', 'finances', 'entreprise']),
  };

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
    return normalizePlan(fromExpand || 'terrain');
  }

  function planModules(planKey) {
    const p = normalizePlan(planKey);
    return PLAN_MODULES[p] || PLAN_MODULES.terrain;
  }

  function hasModule(user, moduleName) {
    return planModules(getCompanyPlan(user)).has(moduleName);
  }

  function canAccessEmployeeTabByPlan(user, tabName) {
    const mod = EMPLOYEE_TAB_MODULE[tabName];
    if (!mod) return true;
    return hasModule(user, mod);
  }

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
    global.showToast?.(
      L === 'fr'
        ? 'Fonction non incluse dans le forfait de votre entreprise.'
        : 'Feature not included in your company plan.',
      false
    );
    return false;
  }

  global.ChantierTrackProductPlans = {
    normalizePlan,
    getCompanyPlan,
    hasModule,
    canAccessEmployeeTabByPlan,
    applyEmployeeUiByPlan,
    guardEmployeeTab,
  };
})(typeof window !== 'undefined' ? window : global);
