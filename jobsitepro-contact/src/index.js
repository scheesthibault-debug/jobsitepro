/**
 * JobsitePro — Cloudflare Worker
 * POST / → formulaire contact → Resend API
 */

const RATE_MAX = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const rateMap = new Map();

const DEFAULT_ORIGINS = [
  /^https:\/\/(www\.)?jobsitepro\.ca$/,
  /^https:\/\/([a-z0-9-]+\.)*pages\.dev$/,
  /^https:\/\/jobsitepro\.example\.com$/,
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
];

function escapeHtml(raw) {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function clientIp(request) {
  return request.headers.get('CF-Connecting-IP')
    || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
    || 'unknown';
}

function rateLimit(ip) {
  const now = Date.now();
  const entry = rateMap.get(ip) || { count: 0, start: now };
  if (now - entry.start > RATE_WINDOW_MS) {
    entry.count = 0;
    entry.start = now;
  }
  entry.count += 1;
  rateMap.set(ip, entry);
  if (rateMap.size > 5000) {
    for (const [key, val] of rateMap) {
      if (now - val.start > RATE_WINDOW_MS) rateMap.delete(key);
    }
  }
  return entry.count <= RATE_MAX;
}

function isAllowedOrigin(origin, env) {
  if (!origin) return true;
  const extra = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (extra.includes(origin)) return true;
  return DEFAULT_ORIGINS.some((re) => re.test(origin));
}

function corsHeaders(origin, env) {
  const allowed = isAllowedOrigin(origin, env);
  return {
    'Access-Control-Allow-Origin': allowed && origin ? origin : 'https://jobsitepro.ca',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

function json(body, status, origin, env) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(origin, env),
    },
  });
}

function buildEmailHtml({ name, email, message, siteUrl }) {
  const safeName = escapeHtml(name || '—');
  const safeEmail = escapeHtml(email);
  const safeMessage = escapeHtml(message).replace(/\n/g, '<br>');
  const site = escapeHtml(siteUrl.replace(/^https?:\/\//, ''));
  const ts = new Date().toLocaleString('fr-CA', { timeZone: 'America/Halifax' });

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <tr>
      <td style="background:#0f172a;padding:28px 32px;">
        <span style="color:#3b82f6;font-size:20px;font-weight:700;letter-spacing:-0.02em;">JobsitePro</span>
        <br>
        <span style="color:#94a3b8;font-size:13px;">Nouvelle demande de contact</span>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        <div style="margin-bottom:20px;">
          <div style="font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#94a3b8;margin-bottom:4px;">NOM</div>
          <div style="font-size:15px;color:#1e293b;">${safeName}</div>
        </div>
        <div style="margin-bottom:20px;">
          <div style="font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#94a3b8;margin-bottom:4px;">COURRIEL</div>
          <a href="mailto:${safeEmail}" style="font-size:15px;color:#3b82f6;text-decoration:none;">${safeEmail}</a>
        </div>
        <div style="margin-bottom:0;">
          <div style="font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#94a3b8;margin-bottom:8px;">MESSAGE</div>
          <div style="font-size:14px;color:#334155;line-height:1.6;border-left:3px solid #3b82f6;padding-left:16px;">
            ${safeMessage}
          </div>
        </div>
      </td>
    </tr>
    <tr>
      <td style="background:#f8fafc;padding:16px 32px;text-align:center;">
        <span style="font-size:12px;color:#94a3b8;">
          <a href="${escapeHtml(siteUrl)}" style="color:#3b82f6;text-decoration:none;">${site}</a>
          — ${escapeHtml(ts)}
        </span>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendViaResend(env, { name, email, message }) {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY not configured');

  const fromName = env.CONTACT_FROM_NAME || 'JobsitePro';
  const fromEmail = env.CONTACT_FROM || 'noreply@jobsitepro.ca';
  const to = env.CONTACT_TO || 'contact@example.com';
  const siteUrl = env.SITE_URL || 'https://jobsitepro.ca';
  const subject = `Demande de contact — ${name || 'Sans nom'}`;
  const html = buildEmailHtml({ name, email, message, siteUrl });

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      reply_to: email,
      subject,
      html,
      text: [
        'JobsitePro — Nouvelle demande de contact',
        '',
        `Nom: ${name || '—'}`,
        `Courriel: ${email}`,
        '',
        'Message:',
        message,
        '',
        siteUrl,
      ].join('\n'),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend ${res.status}: ${body.slice(0, 200)}`);
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin, env) });
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405, origin, env);
    }

    if (!isAllowedOrigin(origin, env) && origin) {
      return json({ error: 'Origin not allowed' }, 403, origin, env);
    }

    if (!rateLimit(clientIp(request))) {
      return json({ error: 'Trop de demandes. Réessayez plus tard.' }, 429, origin, env);
    }

    let data;
    try {
      data = await request.json();
    } catch {
      return json({ error: 'JSON invalide' }, 400, origin, env);
    }

    if (data.website) {
      return json({ success: true }, 200, origin, env);
    }

    const name = String(data.name || '').trim().slice(0, 120);
    const email = String(data.email || '').trim().slice(0, 160);
    const message = String(data.message || '').trim().slice(0, 4000);

    if (!email || !validEmail(email)) {
      return json({ error: 'Courriel invalide ou manquant.' }, 400, origin, env);
    }
    if (!message) {
      return json({ error: 'Message requis.' }, 400, origin, env);
    }

    try {
      await sendViaResend(env, { name, email, message });
      return json({ success: true }, 200, origin, env);
    } catch (e) {
      console.error('[jobsitepro-contact]', e.message || e);
      return json({ error: 'Impossible d\'envoyer le courriel pour le moment.' }, 500, origin, env);
    }
  },
};
