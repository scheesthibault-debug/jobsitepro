/// <reference path="../pb_data/types.d.ts" />
/**
 * JobsiteTrack — enforcement RBAC côté serveur (approve dépenses, audit)
 */

const APPROVE_ROLES = {
  admin_patron: true,
  gestionnaire: true,
  comptable: true,
  contremaitre: true,
};

function authUser(e) {
  return e.httpContext?.get('authRecord') || null;
}

function getRbacRole(user) {
  if (!user) return '';
  let r = String(user.get('rbac_role') || '').toLowerCase().trim();
  if (r) return r;
  const pb = String(user.get('role') || '').toLowerCase().trim();
  if (pb === 'admin' || pb === 'patron') return 'admin_patron';
  if (pb === 'employe') return 'employe';
  return 'admin_patron';
}

function canApproveExpenses(user) {
  return !!APPROVE_ROLES[getRbacRole(user)];
}

function writeAudit(companyId, actorId, action, module, entityType, entityId, meta) {
  try {
    const col = $app.findCollectionByNameOrId('audit_log');
    const r = new Record(col);
    r.set('company', companyId);
    if (actorId) r.set('actor', actorId);
    r.set('action', action);
    r.set('module', module || '');
    r.set('entity_type', entityType || '');
    r.set('entity_id', entityId || '');
    if (meta) r.set('metadata', meta);
    $app.save(r);
  } catch (err) {
    console.log('[rbac_guard] audit skip:', err);
  }
}

onRecordBeforeUpdateRequest((e) => {
  if (e.collection.name !== 'expenses') return;
  const user = authUser(e);
  if (!user) throw new ForbiddenError('Non authentifié');

  let oldStatus = '';
  try {
    const orig = e.record.originalCopy();
    if (orig) oldStatus = String(orig.get('status') || '');
  } catch { /* */ }

  const newStatus = String(e.record.get('status') || '');
  if (oldStatus === newStatus) return;

  if (newStatus === 'approved' || newStatus === 'rejected') {
    if (!canApproveExpenses(user)) {
      throw new ForbiddenError('Permission approve refusée pour votre rôle.');
    }
    writeAudit(
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

onRecordBeforeUpdateRequest((e) => {
  if (e.collection.name !== 'users') return;
  const user = authUser(e);
  if (!user) throw new ForbiddenError('Non authentifié');

  let oldRbac = '';
  try {
    const orig = e.record.originalCopy();
    if (orig) oldRbac = String(orig.get('rbac_role') || '');
  } catch { /* */ }

  const newRbac = String(e.record.get('rbac_role') || '');
  if (oldRbac === newRbac) return;

  if (getRbacRole(user) !== 'admin_patron') {
    throw new ForbiddenError('Seul admin_patron peut modifier rbac_role.');
  }

  writeAudit(user.get('company'), user.id, 'manage_roles', 'utilisateurs', 'users', e.record.id, {
    from: oldRbac,
    to: newRbac,
  });
}, 'users');
