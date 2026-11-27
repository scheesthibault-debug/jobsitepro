/// <reference path="../pb_data/types.d.ts" />
/**
 * Bloque la sync QuickBooks si le document n'est pas routable / approuvé.
 * Appelé avant écriture quickbooks_sync (create/update).
 */

function routeExpense(record) {
  const status = String(record.get('status') || '').toLowerCase();
  if (status !== 'approved') return { allowed: false, reason: 'expense_not_approved' };
  return { allowed: true, reason: 'ok', qbEntityType: 'Purchase' };
}

function routeInvoice(record) {
  const status = String(record.get('statut') || record.get('status') || '').toLowerCase();
  const ok = ['emise', 'issued', 'sent', 'payee', 'paid', 'partielle', ''];
  if (status && !ok.includes(status)) return { allowed: false, reason: 'invoice_not_issued' };
  return { allowed: true, reason: 'ok', qbEntityType: 'Invoice' };
}

onRecordBeforeCreateRequest((e) => {
  if (e.collection.name !== 'quickbooks_sync') return;
  const entityType = String(e.record.get('entity_type') || '').toLowerCase();
  const localId = String(e.record.get('local_id') || '');
  if (!localId || localId === 'pending-oauth') return;

  try {
    if (entityType === 'expense' || entityType === 'purchase') {
      const exp = $app.findRecordById('expenses', localId);
      const r = routeExpense(exp);
      if (!r.allowed) throw new ForbiddenError('QB sync refusée: ' + r.reason);
      e.record.set('entity_type', 'Purchase');
    } else if (entityType === 'invoice' || entityType === 'facture') {
      const inv = $app.findRecordById('factures', localId);
      const r = routeInvoice(inv);
      if (!r.allowed) throw new ForbiddenError('QB sync refusée: ' + r.reason);
      e.record.set('entity_type', 'Invoice');
    }
  } catch (err) {
    if (err instanceof ForbiddenError) throw err;
    throw new ForbiddenError('Enregistrement source introuvable pour sync QB');
  }
}, 'quickbooks_sync');
