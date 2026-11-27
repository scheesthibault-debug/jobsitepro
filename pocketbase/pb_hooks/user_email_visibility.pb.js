/// <reference path="../pb_data/types.d.ts" />
/**
 * Force emailVisibility = true pour tous les employés.
 * - Au démarrage : corrige tous les enregistrements existants avec emailVisibility = false.
 * - À la création : applique emailVisibility = true sur le nouvel utilisateur.
 */

// Correction au démarrage pour tous les utilisateurs existants
onBootstrap((e) => {
  e.next();
  try {
    const records = $app.findAllRecords('users');
    for (const r of records) {
      if (!r.get('emailVisibility')) {
        r.set('emailVisibility', true);
        $app.save(r);
      }
    }
    console.log('[user_email_visibility] emailVisibility corrigé pour les utilisateurs existants');
  } catch (err) {
    console.log('[user_email_visibility] erreur bootstrap:', err);
  }
});

// Force emailVisibility = true à chaque création d'utilisateur
onRecordAfterCreate((e) => {
  const record = e.record;
  if (!record) return;
  try {
    record.set('emailVisibility', true);
    $app.save(record);
  } catch (err) {
    console.log('[user_email_visibility] erreur création:', err);
  }
}, 'users');
