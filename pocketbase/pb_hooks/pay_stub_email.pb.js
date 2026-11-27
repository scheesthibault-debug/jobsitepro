/// <reference path="../pb_data/types.d.ts" />
/**
 * Envoie un courriel à l'employé quand un bulletin passe au statut « sent ».
 * Prérequis : PocketBase → Settings → Mail settings (SMTP configuré).
 */
onRecordAfterUpdate((e) => {
  const record = e.record;
  if (!record) return;
  if (record.get('status') !== 'sent') return;

  const original = record.originalCopy();
  if (original && original.get('status') === 'sent') return;

  const employeeId = record.get('employee');
  if (!employeeId) return;

  let user;
  try {
    user = $app.findRecordById('users', employeeId);
  } catch {
    return;
  }
  const email = user.get('email');
  if (!email) return;

  const appUrl = ($app.settings().meta.appURL || '').replace(/\/$/, '');
  const periodStart = record.get('period_start') || '';
  const periodEnd = record.get('period_end') || '';
  const totalPay = record.get('total_pay') || record.get('gross_pay') || 0;
  const empName = user.get('name') || email;

  const link = appUrl ? `${appUrl}/employe/?tab=pay` : '';
  const html = `
    <p>Bonjour ${empName},</p>
    <p>Votre bulletin de paie est disponible pour la période du <strong>${periodStart}</strong> au <strong>${periodEnd}</strong>.</p>
    <p>Montant indicatif : <strong>${totalPay} $ CAD</strong> (consultez le détail dans l'application).</p>
    ${link ? `<p><a href="${link}">Ouvrir JobsitePro — Ma paie</a></p>` : '<p>Connectez-vous à l\'application employé, section Paie.</p>'}
    <p style="color:#666;font-size:12px">Ce message est automatique. Conservez vos bulletins pour votre comptabilité.</p>
  `;

  const message = new MailerMessage({
    from: {
      address: $app.settings().meta.senderAddress,
      name: $app.settings().meta.senderName || 'JobsitePro',
    },
    to: [{ address: email }],
    subject: 'Bulletin de paie disponible — JobsitePro',
    html,
  });

  try {
    $app.newMailClient().send(message);
  } catch (err) {
    console.log('[pay_stub_email] échec envoi:', err);
  }
}, 'pay_stubs');
