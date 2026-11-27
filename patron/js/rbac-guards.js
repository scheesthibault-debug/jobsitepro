/**
 * JobsiteTrack Patron — guards navigation et actions sensibles
 */
(function (global) {
  'use strict';

  const RBAC = () => global.ChantierTrackRBAC;

  function getUser() {
    if (global.currentUser) return global.currentUser;
    try {
      return JSON.parse(global.localStorage?.getItem('ct_user') || 'null');
    } catch {
      return null;
    }
  }

  /** Pages patron → module requis (dupliqué minimal pour rbac-guards si script absent) */
  const PATRON_PAGE_MODULE = {
    dashboard: 'terrain', chantiers: 'terrain', affectations: 'terrain', pointages: 'terrain',
    employes: 'terrain', horaires: 'terrain', conges: 'terrain', documents: 'terrain',
    photos: 'terrain', travaux: 'terrain', probleme: 'terrain', incidents: 'terrain',
    carte: 'terrain', parametres: 'terrain',
    depenses: 'finances', kilometrage: 'finances', facturation: 'finances',
    clients: 'entreprise', prospects: 'entreprise', factures: 'entreprise', journal: 'entreprise',
    tickets: 'entreprise', contrats: 'entreprise', planning: 'entreprise',
    paie: 'entreprise', backup: 'entreprise', soumissions: 'entreprise', 'couts-chantier': 'entreprise',
    activite: 'entreprise', rentabilite: 'entreprise', rapports: 'entreprise', quickbooks: 'entreprise',
  };

  function planAllowsPage(user, pageId) {
    const PP = global.ChantierTrackProductPlans;
    if (PP?.canAccessPatronPageByPlan) return PP.canAccessPatronPageByPlan(user, pageId);
    const plan = PP?.getCompanyPlan?.(user) || user?.expand?.company?.plan || user?.company_plan || 'terrain';
    const key = String(plan || 'terrain').toLowerCase();
    const mods = key === 'enterprise' || key === 'complet'
      ? new Set(['terrain', 'finances', 'entreprise'])
      : key === 'pro' || key === 'finances'
        ? new Set(['terrain', 'finances'])
        : new Set(['terrain']);
    const mod = PATRON_PAGE_MODULE[pageId];
    if (!mod) return true;
    return mods.has(mod);
  }

  function applyNavPermissions() {
    const rbac = RBAC();
    if (!rbac) return;
    const user = getUser();
    document.querySelectorAll('.nav-item[data-page]').forEach((el) => {
      const page = el.dataset.page;
      const allowedRbac = rbac.canAccessPatronPage(user, page);
      const allowedPlan = planAllowsPage(user, page);
      const allowed = allowedRbac && allowedPlan;
      el.style.display = allowed ? '' : 'none';
      if (!allowed) el.classList.remove('active');
    });
    global.ChantierTrackProductPlans?.applyPatronNavByPlan?.(user);
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

  function guardPatronPage(pageId) {
    const rbac = RBAC();
    if (!rbac) return true;
    const user = getUser();
    const lang = global.lang === 'en' ? 'en' : 'fr';

    if (!rbac.canAccessPatronApp(user)) {
      global.showToast?.(
        lang === 'fr'
          ? 'Ce compte utilise l\'application employé (/employe/).'
          : 'This account uses the employee app (/employe/) only.',
        false
      );
      return false;
    }

    if (!rbac.canAccessPatronPage(user, pageId)) {
      global.showToast?.(
        lang === 'fr'
          ? 'Vous n\'avez pas la permission d\'accéder à cette page.'
          : 'You do not have permission to access this page.',
        false
      );
      return false;
    }
    if (!planAllowsPage(user, pageId)) {
      global.showToast?.(
        lang === 'fr'
          ? 'Page non incluse dans le forfait de votre entreprise.'
          : 'Page not included in your company plan.',
        false
      );
      return false;
    }
    return true;
  }

  function guardPatronAppEntry() {
    const rbac = RBAC();
    if (!rbac) return true;
    const user = getUser();
    const lang = global.lang === 'en' ? 'en' : 'fr';

    if (!rbac.canAccessPatronApp(user)) {
      global.showToast?.(
        lang === 'fr'
          ? 'Accès réservé au tableau de bord patron. Utilisez /employe/ avec un compte employé.'
          : 'Patron dashboard only. Use /employe/ with an employee account.',
        false
      );
      return false;
    }
    return true;
  }

  function guardUserManagementAction() {
    const rbac = RBAC();
    if (!rbac) return true;
    if (!rbac.can(getUser(), 'utilisateurs', 'manage_roles')) {
      global.showToast?.(
        global.lang === 'fr'
          ? 'Seul l\'administrateur peut modifier les rôles.'
          : 'Only the administrator can change roles.',
        false
      );
      return false;
    }
    return true;
  }

  function guardAction(module, action) {
    const rbac = RBAC();
    if (!rbac) return true;
    if (!rbac.can(getUser(), module, action)) {
      global.showToast?.(
        global.lang === 'fr' ? 'Action non autorisée pour votre rôle.' : 'Action not allowed for your role.',
        false
      );
      return false;
    }
    return true;
  }

  function firstAllowedPage() {
    const rbac = RBAC();
    if (!rbac) return 'dashboard';
    const user = getUser();
    const order = [
      'documents',
      'photos',
      'travaux',
      'probleme',
      'incidents',
      'dashboard',
      'chantiers',
      'pointages',
      'employes',
      'depenses',
      'paie',
      'clients',
      'rapports',
      'parametres',
    ];
    for (const p of order) {
      if (rbac.canAccessPatronPage(user, p) && planAllowsPage(user, p)) return p;
    }
    return 'dashboard';
  }

  global.ChantierTrackPatronRBAC = {
    applyNavPermissions,
    guardPatronPage,
    guardPatronAppEntry,
    guardUserManagementAction,
    guardAction,
    firstAllowedPage,
  };
})(typeof window !== 'undefined' ? window : global);
