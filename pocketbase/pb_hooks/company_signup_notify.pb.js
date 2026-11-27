/// <reference path="../pb_data/types.d.ts" />
/**
 * JobsitePro — notification inscription entreprise
 * Déclenché quand un patron admin est créé (après inscription SaaS).
 *
 * Config (variables d'environnement PocketBase) :
 *   JOBSITEPRO_SIGNUP_WEBHOOK_URL  → URL webhook n8n (optionnel)
 *   JOBSITEPRO_ADMIN_EMAIL         → copie admin (optionnel, via n8n de préférence)
 *
 * Payload JSON envoyé au webhook :
 *   { event, company: { id, name, plan, trial_ends, province, is_active }, patron: { id, name, email } }
 */
(function () {
  const WEBHOOK_URL = ($os.getenv('JOBSITEPRO_SIGNUP_WEBHOOK_URL') || '').trim();

  function planLabel(plan) {
    const p = String(plan || 'basic').toLowerCase();
    if (p === 'pro' || p === 'premium') return 'Premium (79 $ + 8$/emp)';
    if (p === 'enterprise' || p === 'elite' || p === 'élite') return 'Élite (139 $ + 8$/emp)';
    return 'Standard (59 $ + 8$/emp)';
  }

  function notifySignup(userRecord) {
    if (!userRecord) return;
    const role = String(userRecord.get('role') || '').toLowerCase();
    if (role !== 'admin' && role !== 'patron') return;

    const companyId = userRecord.get('company');
    if (!companyId) return;

    let company;
    try {
      company = $app.findRecordById('companies', companyId);
    } catch {
      return;
    }

    const payload = {
      event: 'company_signup',
      at: new Date().toISOString(),
      company: {
        id: company.get('id'),
        name: company.get('name') || '',
        plan: company.get('plan') || 'basic',
        plan_label: planLabel(company.get('plan')),
        trial_ends: company.get('trial_ends') || '',
        province: company.get('province') || '',
        is_active: company.get('is_active') !== false,
      },
      patron: {
        id: userRecord.get('id'),
        name: userRecord.get('name') || '',
        email: userRecord.get('email') || '',
      },
    };

    const url = WEBHOOK_URL;
    if (!url) {
      console.log('[company_signup_notify] pas de webhook —', JSON.stringify(payload));
      return;
    }

    try {
      const res = $http.send({
        url,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        timeout: 15,
      });
      console.log('[company_signup_notify] webhook', res.statusCode, company.get('name'));
    } catch (err) {
      console.log('[company_signup_notify] erreur webhook:', err);
    }
  }

  onRecordAfterCreate((e) => {
    notifySignup(e.record);
  }, 'users');
})();
