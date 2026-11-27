/// <reference path="../pb_data/types.d.ts" />
/**
 * JobsitePro — enforcement RBAC (approve dépenses, rôles users).
 * Helpers via require(__hooks + '/lib/security.js') — isolation JSVM.
 */

if (typeof onRecordUpdateRequest === 'function') {
  onRecordUpdateRequest(function (e) {
    var sec = require(__hooks + '/lib/security.js');
    if (sec.isSuperuser(e)) {
      e.next();
      return;
    }
    var user = sec.authUser(e);
    if (!user) throw new ForbiddenError('Non authentifié');

    var oldStatus = '';
    try {
      var orig = e.record.originalCopy();
      if (orig) oldStatus = String(orig.get('status') || '');
    } catch (_) { /* */ }

    var newStatus = String(e.record.get('status') || '');
    if (oldStatus !== newStatus && (newStatus === 'approved' || newStatus === 'rejected')) {
      if (!sec.canApproveExpenses(user)) {
        throw new ForbiddenError('Permission approve refusée pour votre rôle.');
      }
      sec.writeAudit(
        user.get('company'),
        user.id,
        'approve',
        'depenses',
        'expenses',
        e.record.id,
        { from: oldStatus, to: newStatus }
      );
    }
    e.next();
  }, 'expenses');

  onRecordUpdateRequest(function (e) {
    var sec = require(__hooks + '/lib/security.js');
    if (sec.isSuperuser(e)) {
      e.next();
      return;
    }
    var user = sec.authUser(e);
    if (!user) throw new ForbiddenError('Non authentifié');

    var orig = null;
    try {
      orig = e.record.originalCopy();
    } catch (_) { /* */ }
    if (!orig) {
      e.next();
      return;
    }

    var oldCompany = String(sec.fieldOf(orig, 'company') || '');
    var newCompany = String(sec.fieldOf(e.record, 'company') || '');
    if (newCompany !== oldCompany) {
      e.record.set('company', oldCompany);
    }

    var oldRole = String(sec.fieldOf(orig, 'role') || '');
    var newRole = String(sec.fieldOf(e.record, 'role') || '');
    var oldRbac = String(sec.fieldOf(orig, 'rbac_role') || '');
    var newRbac = String(sec.fieldOf(e.record, 'rbac_role') || '');

    var roleChanged = newRole !== oldRole;
    var rbacChanged = newRbac !== oldRbac;
    if (!roleChanged && !rbacChanged) {
      e.next();
      return;
    }

    var authRole = String(user.get('role') || '').toLowerCase().trim();
    var authCompany = String(user.get('company') || '');

    if (authRole !== 'admin' && authRole !== 'patron') {
      throw new ForbiddenError('Modification de rôle refusée.');
    }
    if (!authCompany || authCompany !== oldCompany) {
      throw new ForbiddenError('Rôle modifiable uniquement dans votre entreprise.');
    }
    if (String(user.id) === String(e.record.id)) {
      throw new ForbiddenError('Vous ne pouvez pas modifier votre propre rôle.');
    }

    if (rbacChanged) {
      var nr = String(newRbac || '').toLowerCase().trim();
      if (nr && !sec.VALID_RBAC[nr]) {
        throw new BadRequestError('rbac_role invalide.');
      }
      if (sec.getRbacRole(user) !== 'admin_patron') {
        throw new ForbiddenError('Seul admin_patron peut modifier rbac_role.');
      }
      sec.writeAudit(authCompany, user.id, 'manage_roles', 'utilisateurs', 'users', e.record.id, {
        from: oldRbac,
        to: newRbac,
      });
    }
    e.next();
  }, 'users');
} else {
  onRecordBeforeUpdateRequest(function (e) {
    var sec = require(__hooks + '/lib/security.js');
    if (sec.isSuperuser(e)) return;
    var user = sec.authUser(e);
    if (!user) throw new ForbiddenError('Non authentifié');

    var oldStatus = '';
    try {
      var orig = e.record.originalCopy();
      if (orig) oldStatus = String(orig.get('status') || '');
    } catch (_) { /* */ }

    var newStatus = String(e.record.get('status') || '');
    if (oldStatus !== newStatus && (newStatus === 'approved' || newStatus === 'rejected')) {
      if (!sec.canApproveExpenses(user)) {
        throw new ForbiddenError('Permission approve refusée pour votre rôle.');
      }
      sec.writeAudit(
        user.get('company'),
        user.id,
        'approve',
        'depenses',
        'expenses',
        e.record.id,
        { from: oldStatus, to: newStatus }
      );
    }
  }, 'expenses');

  onRecordBeforeUpdateRequest(function (e) {
    var sec = require(__hooks + '/lib/security.js');
    if (sec.isSuperuser(e)) return;
    var user = sec.authUser(e);
    if (!user) throw new ForbiddenError('Non authentifié');

    var orig = null;
    try {
      orig = e.record.originalCopy();
    } catch (_) { /* */ }
    if (!orig) return;

    var oldCompany = String(sec.fieldOf(orig, 'company') || '');
    var newCompany = String(sec.fieldOf(e.record, 'company') || '');
    if (newCompany !== oldCompany) {
      e.record.set('company', oldCompany);
    }

    var oldRole = String(sec.fieldOf(orig, 'role') || '');
    var newRole = String(sec.fieldOf(e.record, 'role') || '');
    var oldRbac = String(sec.fieldOf(orig, 'rbac_role') || '');
    var newRbac = String(sec.fieldOf(e.record, 'rbac_role') || '');

    var roleChanged = newRole !== oldRole;
    var rbacChanged = newRbac !== oldRbac;
    if (!roleChanged && !rbacChanged) return;

    var authRole = String(user.get('role') || '').toLowerCase().trim();
    var authCompany = String(user.get('company') || '');

    if (authRole !== 'admin' && authRole !== 'patron') {
      throw new ForbiddenError('Modification de rôle refusée.');
    }
    if (!authCompany || authCompany !== oldCompany) {
      throw new ForbiddenError('Rôle modifiable uniquement dans votre entreprise.');
    }
    if (String(user.id) === String(e.record.id)) {
      throw new ForbiddenError('Vous ne pouvez pas modifier votre propre rôle.');
    }

    if (rbacChanged) {
      var nr = String(newRbac || '').toLowerCase().trim();
      if (nr && !sec.VALID_RBAC[nr]) {
        throw new BadRequestError('rbac_role invalide.');
      }
      if (sec.getRbacRole(user) !== 'admin_patron') {
        throw new ForbiddenError('Seul admin_patron peut modifier rbac_role.');
      }
      sec.writeAudit(authCompany, user.id, 'manage_roles', 'utilisateurs', 'users', e.record.id, {
        from: oldRbac,
        to: newRbac,
      });
    }
  }, 'users');
}
