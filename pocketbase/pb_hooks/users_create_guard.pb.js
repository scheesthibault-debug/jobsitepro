/// <reference path="../pb_data/types.d.ts" />
/**
 * JobsitePro — garde-fou création users (anti escalade de privilèges).
 * Helpers via require(__hooks + '/lib/security.js') — isolation JSVM.
 */

if (typeof onRecordCreateRequest === 'function') {
  onRecordCreateRequest(function (e) {
    var sec = require(__hooks + '/lib/security.js');
    if (sec.isSuperuser(e)) {
      e.next();
      return;
    }

    var companyId = String(e.record.get('company') || '').trim();
    if (!companyId) {
      throw new BadRequestError('company est obligatoire à l\'inscription.');
    }
    if (!sec.companyExists(companyId)) {
      throw new BadRequestError('Entreprise introuvable.');
    }

    var auth = sec.authUser(e);
    var existingCount = sec.companyUserCount(companyId);

    if (auth) {
      var authRole = String(auth.get('role') || '').toLowerCase().trim();
      var authCompany = String(auth.get('company') || '').trim();
      if (authRole !== 'admin' && authRole !== 'patron') {
        throw new ForbiddenError('Seul un administrateur peut créer un utilisateur.');
      }
      if (!authCompany || authCompany !== companyId) {
        throw new ForbiddenError('Création limitée à votre entreprise.');
      }

      var wantedRbac = sec.normalizeRbac(e.record.get('rbac_role'));
      if (!wantedRbac) wantedRbac = 'employe';
      if (wantedRbac === 'admin_patron' && sec.getRbacRole(auth) !== 'admin_patron') {
        throw new ForbiddenError('Seul admin_patron peut attribuer le rôle admin_patron.');
      }
      e.record.set('rbac_role', wantedRbac);

      var wantedPb = String(e.record.get('role') || '').toLowerCase().trim();
      if (wantedRbac === 'employe') {
        e.record.set('role', 'employe');
      } else if (wantedPb !== 'admin' && wantedPb !== 'employe') {
        e.record.set('role', 'admin');
      } else if (wantedPb === 'employe' && wantedRbac !== 'employe') {
        e.record.set('role', 'admin');
      }
      e.next();
      return;
    }

    // Inscription publique
    if (existingCount >= 1) {
      e.record.set('role', 'employe');
      e.record.set('rbac_role', 'employe');
      e.record.set('is_active', false);
      e.next();
      return;
    }

    // Premier utilisateur = patron
    var role = String(e.record.get('role') || '').toLowerCase().trim();
    var rbac = sec.normalizeRbac(e.record.get('rbac_role'));
    if (role !== 'admin' && role !== 'patron') {
      role = 'admin';
    }
    e.record.set('role', role === 'patron' ? 'admin' : role);
    e.record.set('rbac_role', rbac || 'admin_patron');
    e.record.set('is_active', true);
    e.next();
  }, 'users');
} else {
  onRecordBeforeCreateRequest(function (e) {
    var sec = require(__hooks + '/lib/security.js');
    if (sec.isSuperuser(e)) return;

    var companyId = String(e.record.get('company') || '').trim();
    if (!companyId) {
      throw new BadRequestError('company est obligatoire à l\'inscription.');
    }
    if (!sec.companyExists(companyId)) {
      throw new BadRequestError('Entreprise introuvable.');
    }

    var auth = sec.authUser(e);
    var existingCount = sec.companyUserCount(companyId);

    if (auth) {
      var authRole = String(auth.get('role') || '').toLowerCase().trim();
      var authCompany = String(auth.get('company') || '').trim();
      if (authRole !== 'admin' && authRole !== 'patron') {
        throw new ForbiddenError('Seul un administrateur peut créer un utilisateur.');
      }
      if (!authCompany || authCompany !== companyId) {
        throw new ForbiddenError('Création limitée à votre entreprise.');
      }

      var wantedRbac = sec.normalizeRbac(e.record.get('rbac_role'));
      if (!wantedRbac) wantedRbac = 'employe';
      if (wantedRbac === 'admin_patron' && sec.getRbacRole(auth) !== 'admin_patron') {
        throw new ForbiddenError('Seul admin_patron peut attribuer le rôle admin_patron.');
      }
      e.record.set('rbac_role', wantedRbac);

      var wantedPb = String(e.record.get('role') || '').toLowerCase().trim();
      if (wantedRbac === 'employe') {
        e.record.set('role', 'employe');
      } else if (wantedPb !== 'admin' && wantedPb !== 'employe') {
        e.record.set('role', 'admin');
      } else if (wantedPb === 'employe' && wantedRbac !== 'employe') {
        e.record.set('role', 'admin');
      }
      return;
    }

    if (existingCount >= 1) {
      e.record.set('role', 'employe');
      e.record.set('rbac_role', 'employe');
      e.record.set('is_active', false);
      return;
    }

    var role = String(e.record.get('role') || '').toLowerCase().trim();
    var rbac = sec.normalizeRbac(e.record.get('rbac_role'));
    if (role !== 'admin' && role !== 'patron') {
      role = 'admin';
    }
    e.record.set('role', role === 'patron' ? 'admin' : role);
    e.record.set('rbac_role', rbac || 'admin_patron');
    e.record.set('is_active', true);
  }, 'users');
}
