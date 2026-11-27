/**
 * JobsitePro Integrations Hub
 * Nginx: location /integrations/ → http://127.0.0.1:3101/
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { config } from './config.js';
import { handleSyncRun, handleSyncStatus } from './routes/sync.js';
import { handleQuickBooksWebhookRoute } from './routes/webhooks.js';

const MAX_BODY = 2 * 1024 * 1024;

function cors(res: ServerResponse, origin: string | undefined) {
  const allowed = config.allowedOrigins;
  const ok = allowed.includes('*') || (origin && allowed.includes(origin));
  res.setHeader('Access-Control-Allow-Origin', ok && origin ? origin : allowed[0] || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error('Payload trop volumineux'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = createServer(async (req, res) => {
  const origin = req.headers.origin;
  cors(res, origin);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  let path = url.pathname.replace(/\/$/, '') || '/';
  path = path.replace(/^\/integrations/, '') || '/';

  try {
    if (req.method === 'GET' && (path === '/health' || path === '/v1/health')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: true,
        service: 'integrations-hub',
        quickbooks_env: config.quickbooks.environment,
      }));
      return;
    }

    const statusMatch = path.match(/^\/v1\/([^/]+)\/status$/);
    if (req.method === 'GET' && statusMatch) {
      await handleSyncStatus(req, res, statusMatch[1]);
      return;
    }

    if (req.method === 'POST' && path === '/v1/sync/run') {
      const raw = await readBody(req);
      const body = raw ? JSON.parse(raw) : {};
      await handleSyncRun(req, res, body);
      return;
    }

    const whMatch = path.match(/^\/v1\/webhooks\/quickbooks\/([^/]+)$/);
    if (req.method === 'POST' && whMatch) {
      const raw = await readBody(req);
      await handleQuickBooksWebhookRoute(req, res, raw, whMatch[1]);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e instanceof Error ? e.message : 'Erreur serveur' }));
  }
});

server.listen(config.port, () => {
  console.log(`[integrations-hub] :${config.port} qb_env=${config.quickbooks.environment}`);
});
