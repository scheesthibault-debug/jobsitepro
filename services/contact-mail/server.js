#!/usr/bin/env node
/**
 * JobsitePro — API formulaire contact (site marketing)
 * POST /api/send  → courriel vers CONTACT_TO
 * Nginx: location /contact/ → http://127.0.0.1:3103/
 */
try {
  require('dotenv').config();
} catch {
  /* dotenv optionnel */
}

const http = require('http');
const nodemailer = require('nodemailer');
const { buildContactEmailHtml, buildContactEmailText } = require('./email-template');

const PORT = Number(process.env.PORT || 3103);
const BIND = process.env.CONTACT_BIND || '127.0.0.1';
const CONTACT_TO = process.env.CONTACT_TO || 'contact@example.com';
const CONTACT_FROM = process.env.CONTACT_FROM || 'noreply@jobsitepro.ca';
const CONTACT_FROM_NAME = process.env.CONTACT_FROM_NAME || 'JobsitePro';
const SITE_LABEL = process.env.CONTACT_SITE_LABEL || 'jobsitepro.example.com';
const CORS_ORIGINS = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const rateMap = new Map();
const RATE_MAX = 8;
const RATE_WINDOW_MS = 60 * 60 * 1000;

function corsHeaders(origin) {
  const allowed = !CORS_ORIGINS.length || CORS_ORIGINS.includes(origin);
  return {
    'Access-Control-Allow-Origin': allowed && origin ? origin : CORS_ORIGINS[0] || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

function json(res, status, body, origin) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(origin) };
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 32_000) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd) return fwd.split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
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
  return entry.count <= RATE_MAX;
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function createTransport() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' }
      : undefined,
  });
}

function mailProvider() {
  const explicit = (process.env.MAIL_PROVIDER || '').trim().toLowerCase();
  if (explicit) return explicit;
  if (process.env.RESEND_API_KEY) return 'resend';
  if (process.env.BREVO_API_KEY) return 'brevo';
  if (process.env.SMTP_HOST) return 'smtp';
  return '';
}

async function sendViaResend({ name, email, message, lang }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY not configured');

  const subject = `Demande de contact — ${name}`;
  const html = buildContactEmailHtml({ name, email, message, siteLabel: SITE_LABEL, lang });
  const text = buildContactEmailText({ name, email, message, siteLabel: SITE_LABEL });
  const from = `${CONTACT_FROM_NAME} <${CONTACT_FROM}>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [CONTACT_TO],
      reply_to: email,
      subject,
      html,
      text,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    let detail = body.slice(0, 300);
    try {
      const j = JSON.parse(body);
      if (j.message) detail = j.message;
    } catch { /* */ }
    if (res.status === 403 && /only send testing emails/i.test(detail)) {
      throw new Error(
        `Resend test: créez le compte Resend avec ${CONTACT_TO} ou vérifiez un domaine. Détail: ${detail.slice(0, 120)}`
      );
    }
    throw new Error(`Resend API ${res.status}: ${detail}`);
  }
}

async function sendViaBrevo({ name, email, message, lang }) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error('BREVO_API_KEY not configured');

  const subject = `Demande de contact — ${name}`;
  const html = buildContactEmailHtml({ name, email, message, siteLabel: SITE_LABEL, lang });
  const text = buildContactEmailText({ name, email, message, siteLabel: SITE_LABEL });

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: CONTACT_FROM_NAME, email: CONTACT_FROM },
      to: [{ email: CONTACT_TO }],
      replyTo: { name, email },
      subject,
      htmlContent: html,
      textContent: text,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Brevo API ${res.status}: ${body.slice(0, 200)}`);
  }
}

async function sendViaSmtp({ name, email, message, lang }) {
  const transport = createTransport();
  if (!transport) throw new Error('SMTP not configured');

  const subject = `Demande de contact — ${name}`;
  const html = buildContactEmailHtml({ name, email, message, siteLabel: SITE_LABEL, lang });
  const text = buildContactEmailText({ name, email, message, siteLabel: SITE_LABEL });

  await transport.sendMail({
    from: { name: CONTACT_FROM_NAME, address: CONTACT_FROM },
    to: CONTACT_TO,
    replyTo: { name, address: email },
    subject,
    text,
    html,
  });
}

async function sendContactMail({ name, email, message, lang }) {
  const provider = mailProvider();
  if (provider === 'resend') {
    await sendViaResend({ name, email, message, lang });
    return;
  }
  if (provider === 'brevo') {
    await sendViaBrevo({ name, email, message, lang });
    return;
  }
  if (provider === 'smtp') {
    await sendViaSmtp({ name, email, message, lang });
    return;
  }
  throw new Error('Mail not configured (RESEND_API_KEY, BREVO_API_KEY or SMTP_HOST)');
}

function routePath(url) {
  const p = (url || '/').split('?')[0];
  return p.replace(/^\/contact/, '') || '/';
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || '';
  const path = routePath(req.url);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(origin));
    res.end();
    return;
  }

  if (req.method === 'GET' && (path === '/health' || path === '/')) {
    json(res, 200, {
      ok: true,
      service: 'jobsitepro-contact-mail',
      provider: mailProvider() || null,
      to: CONTACT_TO,
    }, origin);
    return;
  }

  if (req.method === 'POST' && path === '/api/send') {
    try {
      if (!rateLimit(clientIp(req))) {
        json(res, 429, { ok: false, error: 'Trop de demandes. Réessayez plus tard.' }, origin);
        return;
      }

      const data = await readBody(req);
      if (data.website) {
        json(res, 200, { ok: true });
        return;
      }

      const name = String(data.name || '').trim().slice(0, 120);
      const email = String(data.email || '').trim().slice(0, 160);
      const message = String(data.message || '').trim().slice(0, 4000);
      const lang = data.lang === 'en' ? 'en' : 'fr';

      if (!validEmail(email)) {
        json(res, 400, { ok: false, error: lang === 'en' ? 'Invalid email.' : 'Courriel invalide.' }, origin);
        return;
      }
      if (!message || message.length < 5) {
        json(res, 400, { ok: false, error: lang === 'en' ? 'Message required.' : 'Message requis.' }, origin);
        return;
      }

      await sendContactMail({ name, email, message, lang });
      json(res, 200, { ok: true }, origin);
    } catch (e) {
      console.error('[contact-mail]', e.message || e);
      json(res, 500, {
        ok: false,
        error: 'Impossible d\'envoyer le courriel pour le moment.',
      }, origin);
    }
    return;
  }

  json(res, 404, { ok: false, error: 'Not found' }, origin);
});

server.listen(PORT, BIND, () => {
  console.log(`JobsitePro contact-mail on http://${BIND}:${PORT} → ${CONTACT_TO}`);
  if (!mailProvider()) {
    console.warn('WARN: configure RESEND_API_KEY, BREVO_API_KEY or SMTP_HOST in services/contact-mail/.env');
  }
});
