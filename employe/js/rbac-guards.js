/**
 * JobsiteTrack Employé — guard accès app mobile
 */
(function (global) {
  'use strict';

  function guardEmployeeAppEntry() {
    const rbac = global.ChantierTrackRBAC;
    if (!rbac) return true;
    let user = global.currentUser || null;
    if (!user) {
      try { user = JSON.parse(global.localStorage?.getItem('ct_user') || 'null'); } catch {}
    }
    const lang = global.lang === 'en' ? 'en' : 'fr';

    if (!rbac.canAccessEmployeeApp(user)) {
      global.showToast?.(
        lang === 'fr'
          ? 'Ce compte utilise le tableau de bord patron (/patron/).'
          : 'This account uses the patron dashboard (/patron/).',
        false
      );
      return false;
    }
    return true;
  }

  global.ChantierTrackEmployeeRBAC = {
    guardEmployeeAppEntry,
  };
})(typeof window !== 'undefined' ? window : global);
