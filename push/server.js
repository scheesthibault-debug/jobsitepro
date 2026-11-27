#!/usr/bin/env node
/**
 * Serveur Web Push JobsitePro — notifications même PWA fermée.
 * Proxy Nginx: location /push/ → http://127.0.0.1:3099/
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const webpush = require('web-push');

const CONFIG_PATH = path.join(__dirname, 'vapid.json');

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error('[push] Manquant:', CONFIG_PATH, '— lancez: npm run vapid');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

const config = loadConfig();
const PORT = Number(process.env.PUSH_PORT || config.port || 3099);
const PB_URL = (process.env.POCKETBASE_URL || config.pocketbaseUrl || 'http://127.0.0.1:8090').replace(/\/$/, '');

webpush.setVapidDetails(
  config.subject || 'mailto:admin@chantiertrack.local',
  config.publicKey,
  config.privateKey
);

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function json(res, code, obj) {
  cors(res);
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

async function pbAuthUser(token) {
  if (!token) return null;
  try {
    const res = await fetch(`${PB_URL}/api/collections/users/auth-refresh`, {
      headers: { Authorization: token },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.record || null;
  } catch {
    return null;
  }
}

async function pbAdminList(collection, filter) {
  const admin = config.adminToken;
  if (!admin) return [];
  let qs = '?perPage=100';
  if (filter) qs += '&filter=' + encodeURIComponent(filter);
  try {
    const res = await fetch(`${PB_URL}/api/collections/${collection}/records${qs}`, {
      headers: { Authorization: admin },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.items || [];
  } catch {
    return [];
  }
}

async function pbAdminDelete(collection, id) {
  const admin = config.adminToken;
  if (!admin || !id) return;
  try {
    await fetch(`${PB_URL}/api/collections/${collection}/records/${id}`, {
      method: 'DELETE',
      headers: { Authorization: admin },
    });
  } catch {}
}

async function sendToUser(userId, title, body, url) {
  const subs = await pbAdminList('push_subscriptions', `user="${userId}"`);
  const payload = JSON.stringify({
    title: title || 'JobsitePro',
    body: body || '',
    url: url || '/employe/?tab=more',
    icon: '/employe/icon-192.png',
  });
  let sent = 0;
  for (const rec of subs) {
    const sub = rec.subscription;
    if (!sub || !sub.endpoint) continue;
    try {
      await webpush.sendNotification(sub, payload);
      sent++;
    } catch (e) {
      if (e.statusCode === 410 || e.statusCode === 404) {
        await pbAdminDelete('push_subscriptions', rec.id);
      }
    }
  }
  return sent;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

/** Nginx : /push/health → /health. En local sans proxy, l’app appelle aussi /push/… */
function routePath(rawUrl) {
  let p = (rawUrl || '').split('?')[0].replace(/\/$/, '') || '/';
  if (p === '/push') return '/';
  if (p.startsWith('/push/')) p = p.slice(5) || '/';
  return p;
}

const server = http.createServer(async (req, res) => {
  const url = routePath(req.url);

  if (req.method === 'OPTIONS') {
    cors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && (url === '/vapid-public' || url === '/')) {
    if (url === '/') {
      json(res, 200, { ok: true, service: 'chantiertrack-push' });
      return;
    }
    json(res, 200, { publicKey: config.publicKey });
    return;
  }

  if (req.method === 'GET' && url === '/health') {
    json(res, 200, { ok: true, hasAdminToken: !!config.adminToken });
    return;
  }

  if (req.method === 'POST' && url === '/send') {
    try {
      const auth = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
      const user = await pbAuthUser(auth);
      const role = (user?.role || '').toLowerCase();
      if (!user || role !== 'admin') {
        json(res, 403, { error: 'Forbidden' });
        return;
      }
      if (!config.adminToken) {
        json(res, 503, { error: 'adminToken missing in vapid.json' });
        return;
      }
      const data = await readBody(req);
      const userIds = Array.isArray(data.userIds)
        ? data.userIds
        : data.userId
          ? [data.userId]
          : [];
      const title = data.title || 'JobsitePro';
      const msg = data.body || '';
      const targetUrl = data.url || '/employe/?tab=more';
      let total = 0;
      for (const uid of userIds.filter(Boolean)) {
        total += await sendToUser(uid, title, msg, targetUrl);
      }
      json(res, 200, { sent: total, users: userIds.length });
    } catch (e) {
      json(res, 500, { error: e.message || 'Server error' });
    }
    return;
  }

  json(res, 404, { error: 'Not found' });
});

const BIND = process.env.PUSH_BIND || '127.0.0.1';
server.listen(PORT, BIND, () => {
  console.log(`[chantiertrack-push] http://${BIND}:${PORT}`);
  console.log(`[chantiertrack-push] PocketBase: ${PB_URL}`);
  console.log(`[chantiertrack-push] adminToken: ${config.adminToken ? 'OK' : 'MANQUANT — voir PUSH_NOTIFICATIONS.md'}`);
});
