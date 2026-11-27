/**
 * JobsiteTrack — RBAC (rôles métier + permissions module.action)
 * Rôles : admin_patron | gestionnaire | comptable | contremaitre | employe | lecture_seule
 */
(function (global) {
  'use strict';

  const RBAC_ROLES = [
    'admin_patron',
    'gestionnaire',
    'comptable',
    'contremaitre',
    'employe',
    'lecture_seule',
  ];

  const RBAC_ROLE_LABELS = {
    admin_patron: { fr: 'Administrateur (patron)', en: 'Administrator (owner)' },
    gestionnaire: { fr: 'Gestionnaire', en: 'Manager' },
    comptable: { fr: 'Comptable', en: 'Accountant' },
    contremaitre: { fr: 'Contremaître', en: 'Foreman' },
    employe: { fr: 'Employé (app mobile)', en: 'Employee (mobile app)' },
    lecture_seule: { fr: 'Lecture seule', en: 'Read only' },
  };

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
  ];

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
    },
    employe: {
      chantier: ['view'],
      pointage: ['view', 'create'],
      depenses: ['view', 'create'],
      ocr_recus: ['create'],
      paie_export: ['view'],
      parametres: ['view', 'edit'],
    },
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
    },
  };

  const PATRON_DESKTOP_ROLES = new Set([
    'admin_patron',
    'gestionnaire',
    'comptable',
    'contremaitre',
    'lecture_seule',
  ]);

  function normalizePbRole(user) {
    return String(user?.role || '').toLowerCase().trim();
  }

  function getRbacRole(user) {
    if (!user) return 'employe';
    const pb = normalizePbRole(user);
    const raw = String(user.rbac_role || '').toLowerCase().trim();
    if (pb === 'admin' || pb === 'patron') {
      if (raw && raw !== 'employe' && RBAC_ROLES.includes(raw)) return raw;
      return 'admin_patron';
    }
    if (RBAC_ROLES.includes(raw)) return raw;
    return 'employe';
  }

  function isAdminPatron(user) {
    return getRbacRole(user) === 'admin_patron';
  }

  function canAccessPatronApp(user) {
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

  function mergeAuthUserRecord(incoming, previous) {
    const prev = previous && typeof previous === 'object' ? previous : {};
    const inc = incoming && typeof incoming === 'object' ? incoming : {};
    const merged = { ...prev, ...inc };
    ['role', 'rbac_role', 'responsibility_role', 'company', 'name', 'email'].forEach((key) => {
      const v = merged[key];
      if ((v === undefined || v === null || v === '') && prev[key] != null && prev[key] !== '') {
        merged[key] = prev[key];
      }
    });
    if (prev.expand || inc.expand) {
      merged.expand = { ...(prev.expand || {}), ...(inc.expand || {}) };
    }
    return merged;
  }

  function patronAppUrl() {
    const base = (typeof window !== 'undefined' ? window.location.origin : '').replace(/\/$/, '');
    return `${base}/patron/`;
  }

  global.ChantierTrackRBAC = {
    RBAC_ROLES,
    RBAC_ROLE_LABELS,
    getRbacRole,
    canAccessPatronApp,
    canAccessEmployeeApp,
    can,
    hasPermission,
    mergeAuthUserRecord,
    patronAppUrl,
    rbacRoleLabel,
  };
})(typeof window !== 'undefined' ? window : global);
