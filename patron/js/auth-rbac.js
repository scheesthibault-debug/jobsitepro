/**
 * JobsiteTrack — RBAC (rôles métier + permissions module.action)
 * Rôles : admin_patron | gestionnaire | comptable | contremaitre | securite_sst | employe | lecture_seule
 */
(function (global) {
  'use strict';

  const RBAC_ROLES = [
    'admin_patron',
    'gestionnaire',
    'comptable',
    'contremaitre',
    'securite_sst',
    'employe',
    'lecture_seule',
  ];

  const RBAC_ROLE_LABELS = {
    admin_patron: { fr: 'Administrateur', en: 'Administrator' },
    gestionnaire: { fr: 'Gestionnaire', en: 'Manager' },
    comptable: { fr: 'Comptable', en: 'Accountant' },
    contremaitre: { fr: 'Contremaître', en: 'Foreman' },
    securite_sst: { fr: 'Sécurité SST', en: 'Health & safety (SST)' },
    employe: { fr: 'Employé (mobile)', en: 'Employee (mobile)' },
    lecture_seule: { fr: 'Lecture seule', en: 'Read only' },
  };

  /** Compat PocketBase responsibility_role (champ legacy) */
  const RBAC_TO_RESPONSIBILITY = {
    admin_patron: 'responsable_chantier',
    gestionnaire: 'responsable_chantier',
    comptable: 'autre',
    contremaitre: 'contremaitre',
    securite_sst: 'securite_sst',
    employe: 'ouvrier',
    lecture_seule: 'autre',
  };

  const RESPONSIBILITY_TO_RBAC = {
    ouvrier: 'employe',
    responsable_chantier: 'gestionnaire',
    contremaitre: 'contremaitre',
    securite_sst: 'securite_sst',
    conducteur_travaux: 'gestionnaire',
    autre: 'lecture_seule',
  };

  function rbacFromResponsibility(responsibilityKey) {
    const k = String(responsibilityKey || '').toLowerCase().trim();
    return RESPONSIBILITY_TO_RBAC[k] || 'employe';
  }

  function responsibilityFromRbac(rbacRole) {
    const k = String(rbacRole || '').toLowerCase().trim();
    return RBAC_TO_RESPONSIBILITY[k] || 'ouvrier';
  }

  const MODULES = [
    'chantier',
    'pointage',
    'depenses',
    'ocr_recus',
    'facturation',
    'paie_export',
    'crm',
    'integrations_quickbooks',
    'rapports',
    'utilisateurs',
    'parametres',
    'documents_securite',
  ];

  /** Pages de la section Documents (menu latéral) */
  const DOCUMENTS_SECTION_PAGES = new Set(['documents', 'photos', 'travaux', 'probleme', 'incidents']);

  const ACTIONS = ['view', 'create', 'edit', 'delete', 'approve', 'export', 'connect', 'manage_roles'];

  /** @type {Record<string, Record<string, string[]>>} */
  const ROLE_PERMISSIONS = {
    gestionnaire: {
      chantier: ['view', 'create', 'edit'],
      pointage: ['view', 'approve'],
      depenses: ['view', 'approve'],
      ocr_recus: ['view'],
      facturation: ['view'],
      paie_export: ['view'],
      crm: ['view', 'create', 'edit'],
      rapports: ['view', 'export'],
      utilisateurs: ['view'],
      parametres: ['view', 'edit'],
      documents_securite: ['view', 'create', 'edit'],
    },
    comptable: {
      chantier: ['view'],
      pointage: ['view', 'export'],
      depenses: ['view', 'approve', 'export'],
      ocr_recus: ['view'],
      facturation: ['view', 'create', 'edit', 'export'],
      paie_export: ['view', 'export'],
      crm: ['view', 'create', 'edit'],
      integrations_quickbooks: ['view', 'connect', 'export'],
      rapports: ['view', 'export'],
      utilisateurs: ['view'],
      parametres: ['view'],
      documents_securite: ['view'],
    },
    contremaitre: {
      chantier: ['view', 'create', 'edit'],
      pointage: ['view', 'approve'],
      depenses: ['view', 'approve'],
      ocr_recus: ['view'],
      facturation: ['view'],
      paie_export: ['view'],
      crm: ['view'],
      rapports: ['view', 'export'],
      utilisateurs: ['view'],
      parametres: ['view'],
      documents_securite: ['view', 'create', 'edit', 'approve'],
    },
    securite_sst: {
      documents_securite: ['view', 'create', 'edit', 'delete', 'approve', 'export'],
    },
    employe: {},
    lecture_seule: {
      chantier: ['view'],
      pointage: ['view'],
      depenses: ['view'],
      ocr_recus: ['view'],
      facturation: ['view'],
      paie_export: ['view'],
      crm: ['view'],
      rapports: ['view'],
      utilisateurs: ['view'],
      parametres: ['view'],
      documents_securite: ['view'],
    },
  };

  /** Pages patron → permission requise */
  const PATRON_PAGE_RULES = {
    dashboard: { module: 'chantier', action: 'view' },
    chantiers: { module: 'chantier', action: 'view' },
    affectations: { module: 'chantier', action: 'view' },
    pointages: { module: 'pointage', action: 'view' },
    employes: { module: 'utilisateurs', action: 'view' },
    horaires: { module: 'pointage', action: 'view' },
    conges: { module: 'utilisateurs', action: 'view' },
    documents: { module: 'documents_securite', action: 'view' },
    photos: { module: 'documents_securite', action: 'view' },
    travaux: { module: 'documents_securite', action: 'view' },
    probleme: { module: 'documents_securite', action: 'view' },
    incidents: { module: 'documents_securite', action: 'view' },
    clients: { module: 'crm', action: 'view' },
    prospects: { module: 'crm', action: 'view' },
    factures: { module: 'crm', action: 'view' },
    journal: { module: 'crm', action: 'view' },
    tickets: { module: 'crm', action: 'view' },
    contrats: { module: 'crm', action: 'view' },
    planning: { module: 'crm', action: 'view' },
    paie: { module: 'paie_export', action: 'view' },
    backup: { module: 'parametres', action: 'edit', adminOnly: true },
    kilometrage: { module: 'facturation', action: 'view' },
    facturation: { module: 'facturation', action: 'view' },
    depenses: { module: 'depenses', action: 'view' },
    soumissions: { module: 'facturation', action: 'view' },
    'couts-chantier': { module: 'chantier', action: 'view' },
    carte: { module: 'chantier', action: 'view' },
    activite: { module: 'rapports', action: 'view' },
    rentabilite: { module: 'rapports', action: 'view' },
    rapports: { module: 'rapports', action: 'view' },
    quickbooks: { module: 'integrations_quickbooks', action: 'view' },
    wagepoint: { module: 'paie_export', action: 'view' },
    parametres: { module: 'parametres', action: 'view' },
  };

  const PATRON_DESKTOP_ROLES = new Set([
    'admin_patron',
    'gestionnaire',
    'comptable',
    'contremaitre',
    'securite_sst',
    'lecture_seule',
  ]);

  function normalizePbRole(user) {
    return String(user?.role || '').toLowerCase().trim();
  }

  function getRbacRole(user) {
    if (!user) return 'employe';
    const pb = normalizePbRole(user);
    const raw = String(user.rbac_role || '').toLowerCase().trim();
    // role PocketBase admin/patron = accès patron (ignore rbac_role=employe erroné en base)
    if (pb === 'admin' || pb === 'patron') {
      if (raw && raw !== 'employe' && RBAC_ROLES.includes(raw)) return raw;
      return 'admin_patron';
    }
    if (RBAC_ROLES.includes(raw)) return raw;
    if (pb === 'employe') return 'employe';
    return 'employe';
  }

  function isAdminPatron(user) {
    return getRbacRole(user) === 'admin_patron';
  }

  function canAccessPatronApp(user) {
    const pb = normalizePbRole(user);
    if (pb === 'admin' || pb === 'patron') return true;
    return PATRON_DESKTOP_ROLES.has(getRbacRole(user));
  }

  function canAccessEmployeeApp(user) {
    return getRbacRole(user) === 'employe';
  }

  function can(user, module, action) {
    if (!user) return false;
    const role = getRbacRole(user);
    if (role === 'admin_patron') return true;
    const modPerms = ROLE_PERMISSIONS[role]?.[module];
    if (!modPerms) return false;
    return modPerms.includes(action);
  }

  function hasPermission(user, permission) {
    if (!permission) return true;
    const parts = String(permission).split('.');
    if (parts.length !== 2) return false;
    return can(user, parts[0], parts[1]);
  }

  function canAccessPatronPage(user, pageId) {
    if (!canAccessPatronApp(user)) return false;
    const rule = PATRON_PAGE_RULES[pageId];
    if (!rule) return true;
    if (rule.adminOnly && !isAdminPatron(user)) return false;
    return can(user, rule.module, rule.action);
  }

  function rbacRoleLabel(roleKey, lang) {
    const L = lang === 'en' ? 'en' : 'fr';
    return RBAC_ROLE_LABELS[roleKey]?.[L] || roleKey;
  }

  function rbacRoleOptions(selected, lang) {
    const L = lang === 'en' ? 'en' : 'fr';
    return RBAC_ROLES.map((key) => {
      const sel = key === selected ? ' selected' : '';
      return `<option value="${key}"${sel}>${RBAC_ROLE_LABELS[key][L]}</option>`;
    }).join('');
  }

  function resolvePbRoleForRbac(rbacRole) {
    return rbacRole === 'employe' ? 'employe' : 'admin';
  }

  function mergeAuthUserRecord(incoming, previous) {
    const prev = previous && typeof previous === 'object' ? previous : {};
    const inc = incoming && typeof incoming === 'object' ? incoming : {};
    const merged = { ...prev, ...inc };
    ['role', 'rbac_role', 'responsibility_role', 'company', 'name', 'email'].forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(inc, key) && inc[key] != null && inc[key] !== '') {
        merged[key] = inc[key];
        return;
      }
      const v = merged[key];
      if ((v === undefined || v === null || v === '') && prev[key] != null && prev[key] !== '') {
        merged[key] = prev[key];
      }
    });
    const pb = normalizePbRole(merged);
    if ((pb === 'admin' || pb === 'patron') && merged.rbac_role === 'employe') {
      merged.rbac_role = 'admin_patron';
    }
    if (prev.expand || inc.expand) {
      merged.expand = { ...(prev.expand || {}), ...(inc.expand || {}) };
    }
    return merged;
  }

  /** Auth PocketBase renvoie souvent un record minimal sans role/rbac_role — recharge le profil complet. */
  async function hydrateAuthUserProfile(fetchRecordById, authRecord, previous) {
    const base = mergeAuthUserRecord(authRecord, previous);
    if (typeof fetchRecordById !== 'function' || !base?.id) return base;
    try {
      const full = await fetchRecordById(base.id);
      if (full && typeof full === 'object') return mergeAuthUserRecord(full, base);
    } catch (_) {}
    return base;
  }

  function getWebAppBase() {
    if (typeof window === 'undefined' || !window.location) return '';
    const { protocol, origin, pathname } = window.location;
    if (protocol.startsWith('http')) {
      if (pathname.includes('/patron/')) return origin + pathname.replace(/\/patron\/?.*$/, '');
      if (pathname.includes('/employe/')) return origin + pathname.replace(/\/employe\/?.*$/, '');
      return origin;
    }
    return origin || '';
  }

  function employeAppUrl() {
    const base = getWebAppBase().replace(/\/$/, '');
    return `${base}/employe/`;
  }

  function patronAppUrl() {
    const base = getWebAppBase().replace(/\/$/, '');
    return `${base}/patron/`;
  }

  function isPatronAdmin(user) {
    const u = user || (typeof global.currentUser !== 'undefined' ? global.currentUser : null);
    return isAdminPatron(u) || can(u, 'utilisateurs', 'manage_roles');
  }

  global.ChantierTrackRBAC = {
    RBAC_ROLES,
    RBAC_ROLE_LABELS,
    MODULES,
    ACTIONS,
    ROLE_PERMISSIONS,
    PATRON_PAGE_RULES,
    DOCUMENTS_SECTION_PAGES,
    getRbacRole,
    isAdminPatron,
    canAccessPatronApp,
    canAccessEmployeeApp,
    can,
    hasPermission,
    canAccessPatronPage,
    rbacRoleLabel,
    rbacRoleOptions,
    resolvePbRoleForRbac,
    mergeAuthUserRecord,
    hydrateAuthUserProfile,
    getWebAppBase,
    employeAppUrl,
    patronAppUrl,
    isPatronAdmin,
    normalizePbRole,
    RESPONSIBILITY_TO_RBAC,
    RBAC_TO_RESPONSIBILITY,
    rbacFromResponsibility,
    responsibilityFromRbac,
  };
})(typeof window !== 'undefined' ? window : global);
