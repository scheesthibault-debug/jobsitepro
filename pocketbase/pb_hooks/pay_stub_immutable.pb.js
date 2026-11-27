/// <reference path="../pb_data/types.d.ts" />
/**
 * Empêche la modification d'un bulletin déjà envoyé (traçabilité paie / Loi 25).
 */
onRecordBeforeUpdate((e) => {
  const record = e.record;
  const original = record.originalCopy();
  if (!original) return;
  if (original.get('status') !== 'sent') return;
  if (record.get('status') === 'sent' && record.get('gross_pay') === original.get('gross_pay')) {
    return; // métadonnées mineures seulement — à restreindre selon politique
  }
  throw new BadRequestError('Bulletin envoyé — modification interdite. Créez un ajustement ou contactez l\'administrateur.');
}, 'pay_stubs');
