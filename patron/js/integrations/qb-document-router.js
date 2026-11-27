/**
 * JobsitePro — routage document → entité QuickBooks
 * PocketBase = source opérationnelle | QuickBooks = source comptable
 */
(function (global) {
  'use strict';

  const QB_ENTITY = {
    INVOICE: 'Invoice',
    BILL: 'Bill',
    EXPENSE: 'Purchase',
    CUSTOMER: 'Customer',
    VENDOR: 'Vendor',
    ATTACHMENT: 'AttachmentOnly',
  };

  const PB_COLLECTION_MAP = {
    factures: QB_ENTITY.INVOICE,
    expenses: QB_ENTITY.EXPENSE,
    clients: QB_ENTITY.CUSTOMER,
    paiements: 'Payment',
    photos: QB_ENTITY.ATTACHMENT,
    safety_documents: QB_ENTITY.ATTACHMENT,
    payroll_documents: QB_ENTITY.ATTACHMENT,
  };

  /**
   * @param {object} input
   * @param {string} input.collection - collection PocketBase source
   * @param {object} input.record - enregistrement PB
   * @param {string} [input.fileField] - champ fichier
   * @returns {{ allowed: boolean, qbEntityType: string, reason: string, requiresApproval: boolean }}
   */
  function routeDocumentToQuickBooks(input) {
    const collection = String(input?.collection || '').toLowerCase();
    const record = input?.record || {};
    const status = String(record.status || record.statut || '').toLowerCase();

    if (!collection) {
      return { allowed: false, qbEntityType: '', reason: 'collection_missing', requiresApproval: false };
    }

    if (collection === 'expenses') {
      if (status !== 'approved') {
        return { allowed: false, qbEntityType: QB_ENTITY.EXPENSE, reason: 'expense_not_approved', requiresApproval: true };
      }
      if (!record.amount && !record.vendor) {
        return { allowed: false, qbEntityType: QB_ENTITY.EXPENSE, reason: 'expense_incomplete', requiresApproval: false };
      }
      return { allowed: true, qbEntityType: QB_ENTITY.EXPENSE, reason: 'ok', requiresApproval: false };
    }

    if (collection === 'factures') {
      const okStatus = ['emise', 'issued', 'sent', 'payee', 'paid', 'partielle'].includes(status);
      if (!okStatus && status) {
        return { allowed: false, qbEntityType: QB_ENTITY.INVOICE, reason: 'invoice_not_issued', requiresApproval: false };
      }
      return { allowed: true, qbEntityType: QB_ENTITY.INVOICE, reason: 'ok', requiresApproval: false };
    }

    if (collection === 'clients') {
      return { allowed: true, qbEntityType: QB_ENTITY.CUSTOMER, reason: 'ok', requiresApproval: false };
    }

    if (collection === 'photos' || collection === 'safety_documents') {
      if (!record.site && !record.company) {
        return { allowed: false, qbEntityType: QB_ENTITY.ATTACHMENT, reason: 'attachment_no_context', requiresApproval: false };
      }
      return { allowed: true, qbEntityType: QB_ENTITY.ATTACHMENT, reason: 'ok', requiresApproval: false };
    }

    const mapped = PB_COLLECTION_MAP[collection];
    if (mapped) {
      return { allowed: true, qbEntityType: mapped, reason: 'ok', requiresApproval: false };
    }

    return { allowed: false, qbEntityType: '', reason: 'unsupported_collection', requiresApproval: false };
  }

  function syncKey(companyId, entityType, localId) {
    return `${companyId}:${entityType}:${localId}`;
  }

  global.JobsiteProQBDocumentRouter = {
    QB_ENTITY,
    PB_COLLECTION_MAP,
    routeDocumentToQuickBooks,
    syncKey,
  };
})(typeof window !== 'undefined' ? window : global);
