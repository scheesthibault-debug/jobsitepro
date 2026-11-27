function escapeHtml(raw) {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatTimestamp(date, lang) {
  const d = date || new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const h = pad(d.getHours());
  const min = pad(d.getMinutes());
  const sec = pad(d.getSeconds());
  if (lang === 'en') return `${y}-${m}-${day} ${h}:${min}:${sec}`;
  return `${y}-${m}-${day} ${h} h ${min} min ${sec} s`;
}

/**
 * Courriel HTML — même structure que TS Solution Tech Acadie, branding JobsitePro.
 */
function buildContactEmailHtml({ name, email, message, siteLabel, lang }) {
  const L = lang === 'en' ? 'en' : 'fr';
  const labels = L === 'en'
    ? { title: 'JobsitePro', sub: 'New contact request', name: 'NAME', email: 'EMAIL', message: 'MESSAGE' }
    : { title: 'JobsitePro', sub: 'Nouvelle demande de contact', name: 'NOM', email: 'COURRIEL', message: 'MESSAGE' };

  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeMessage = escapeHtml(message).replace(/\n/g, '<br>');
  const ts = formatTimestamp(new Date(), L);
  const site = escapeHtml(siteLabel || 'jobsitepro.example.com');

  return `<!DOCTYPE html>
<html lang="${L}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#f3f4f6;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
    <div style="background:#0c0e12;padding:28px 24px;text-align:center">
      <div style="font-size:22px;font-weight:700;color:#EA8C2A;letter-spacing:.02em">${labels.title}</div>
      <div style="font-size:13px;color:#9ca3af;margin-top:6px">${labels.sub}</div>
    </div>
    <div style="padding:24px">
      <div style="margin-bottom:18px">
        <div style="font-size:11px;font-weight:600;letter-spacing:.08em;color:#9ca3af;margin-bottom:6px">${labels.name}</div>
        <div style="font-size:15px;color:#111827">${safeName}</div>
      </div>
      <div style="margin-bottom:18px">
        <div style="font-size:11px;font-weight:600;letter-spacing:.08em;color:#9ca3af;margin-bottom:6px">${labels.email}</div>
        <div style="font-size:15px"><a href="mailto:${safeEmail}" style="color:#378ADD;text-decoration:none">${safeEmail}</a></div>
      </div>
      <div>
        <div style="font-size:11px;font-weight:600;letter-spacing:.08em;color:#9ca3af;margin-bottom:6px">${labels.message}</div>
        <div style="background:#f9fafb;border-left:3px solid #EA8C2A;border-radius:0 8px 8px 0;padding:14px 16px;font-size:14px;line-height:1.6;color:#374151">${safeMessage}</div>
      </div>
    </div>
    <div style="background:#f3f4f6;padding:12px 16px;text-align:center;font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb">
      <a href="https://${site}" style="color:#6b7280;text-decoration:none">${site}</a>
      <span style="color:#d1d5db"> · </span>${ts}
    </div>
  </div>
</body>
</html>`;
}

function buildContactEmailText({ name, email, message, siteLabel }) {
  return [
    'JobsitePro — Nouvelle demande de contact',
    '',
    `Nom: ${name}`,
    `Courriel: ${email}`,
    '',
    'Message:',
    message,
    '',
    siteLabel || 'jobsitepro.example.com',
  ].join('\n');
}

module.exports = { buildContactEmailHtml, buildContactEmailText, escapeHtml };
