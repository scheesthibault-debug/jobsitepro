/**
 * JobsitePro — helpers sécurité partagés (CommonJS / goja ES5).
 * Chaque handler PocketBase doit: var sec = require(__hooks + '/lib/security.js');
 */
'use strict';

var VALID_RBAC = {
  admin_patron: true,
  gestionnaire: true,
  comptable: true,
  contremaitre: true,
  securite_sst: true,
  employe: true,
  lecture_seule: true,
};

var APPROVE_ROLES = {
  admin_patron: true,
  gestionnaire: true,
  comptable: true,
  contremaitre: true,
};

/** PB 0.22: $app.dao() ; PB 0.23+: $app directement. */
function dao() {
  try {
    if ($app && typeof $app.dao === 'function') {
      return $app.dao();
    }
  } catch (_) { /* */ }
  return $app;
}

function findRecordById(collection, id) {
  return dao().findRecordById(collection, id);
}

function findCollectionByNameOrId(nameOrId) {
  return dao().findCollectionByNameOrId(nameOrId);
}

function findRecordsByFilter(collection, filter, sort, limit, offset) {
  var d = dao();
  var s = sort == null ? '' : sort;
  var lim = limit == null ? 50 : limit;
  var off = offset == null ? 0 : offset;
  return d.findRecordsByFilter(collection, filter, s, lim, off);
}

function saveRecord(record) {
  var d = dao();
  if (typeof d.save === 'function') {
    return d.save(record);
  }
  if (typeof d.saveRecord === 'function') {
    return d.saveRecord(record);
  }
  if (typeof $app.save === 'function') {
    return $app.save(record);
  }
  throw new Error('Aucun save() disponible sur dao/$app');
}

function authUser(e) {
  if (e && e.auth) return e.auth;
  try {
    if (e && e.httpContext && typeof e.httpContext.get === 'function') {
      return e.httpContext.get('authRecord') || null;
    }
  } catch (_) { /* */ }
  try {
    if (e && typeof e.requestInfo === 'function') {
      var info = e.requestInfo();
      if (info && info.auth) return info.auth;
      if (info && info.authRecord) return info.authRecord;
    }
  } catch (_) { /* */ }
  return null;
}

function isSuperuser(e) {
  try {
    if (e && typeof e.hasSuperuserAuth === 'function' && e.hasSuperuserAuth()) return true;
  } catch (_) { /* */ }
  try {
    if (e && e.auth && typeof e.auth.isSuperuser === 'function' && e.auth.isSuperuser()) return true;
  } catch (_) { /* */ }
  try {
    if (e && e.httpContext && typeof e.httpContext.get === 'function') {
      if (e.httpContext.get('admin')) return true;
    }
  } catch (_) { /* */ }
  return false;
}

/** Fail-closed : défaut = employe (jamais admin_patron). */
function getRbacRole(user) {
  if (!user) return 'employe';
  var r = String(user.get('rbac_role') || '').toLowerCase().trim();
  if (VALID_RBAC[r]) return r;
  var pb = String(user.get('role') || '').toLowerCase().trim();
  if (pb === 'admin' || pb === 'patron') return 'admin_patron';
  if (pb === 'employe') return 'employe';
  return 'employe';
}

function canApproveExpenses(user) {
  return !!APPROVE_ROLES[getRbacRole(user)];
}

function normalizeRbac(raw) {
  var r = String(raw || '').toLowerCase().trim();
  return VALID_RBAC[r] ? r : '';
}

function companyExists(companyId) {
  if (!companyId) return false;
  try {
    findRecordById('companies', companyId);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Fail-closed : en cas d'erreur DB, lève une erreur (ne retourne JAMAIS 0).
 * Un échec de lecture ne doit jamais être traité comme « company vide → admin ».
 */
function companyUserCount(companyId) {
  var safeId = String(companyId || '').replace(/"/g, '');
  if (!safeId) {
    throw new BadRequestError('company invalide.');
  }
  var filter = 'company = "' + safeId + '"';
  try {
    var rows = findRecordsByFilter('users', filter, '-created', 5, 0);
    if (!rows) {
      throw new Error('findRecordsByFilter returned empty');
    }
    return rows.length;
  } catch (err) {
    console.log('[security] companyUserCount fail-closed:', String(err));
    throw new BadRequestError(
      'Impossible de vérifier les utilisateurs de l\'entreprise. Réessayez.'
    );
  }
}

function writeAudit(companyId, actorId, action, module, entityType, entityId, meta) {
  try {
    var col = findCollectionByNameOrId('audit_log');
    var r = new Record(col);
    r.set('company', companyId);
    if (actorId) r.set('actor', actorId);
    r.set('action', action);
    r.set('module', module || '');
    r.set('entity_type', entityType || '');
    r.set('entity_id', entityId || '');
    if (meta) r.set('metadata', meta);
    saveRecord(r);
  } catch (err) {
    console.log('[security] audit skip:', String(err));
  }
}

function fieldOf(rec, name) {
  try {
    return rec.get(name);
  } catch (_) {
    return null;
  }
}

module.exports = {
  VALID_RBAC: VALID_RBAC,
  APPROVE_ROLES: APPROVE_ROLES,
  dao: dao,
  findRecordById: findRecordById,
  findCollectionByNameOrId: findCollectionByNameOrId,
  findRecordsByFilter: findRecordsByFilter,
  saveRecord: saveRecord,
  authUser: authUser,
  isSuperuser: isSuperuser,
  getRbacRole: getRbacRole,
  canApproveExpenses: canApproveExpenses,
  normalizeRbac: normalizeRbac,
  companyExists: companyExists,
  companyUserCount: companyUserCount,
  writeAudit: writeAudit,
  fieldOf: fieldOf,
};
