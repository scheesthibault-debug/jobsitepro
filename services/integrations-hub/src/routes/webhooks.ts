import type { IncomingMessage, ServerResponse } from 'node:http';
import { assertServiceAuth } from '../pocketbase/client.js';
import { handleQuickBooksWebhook, verifyIntuitSignature } from '../services/webhooks/quickbooks-webhook.js';

export async function handleQuickBooksWebhookRoute(
  req: IncomingMessage,
  res: ServerResponse,
  rawBody: string,
  companyId: string,
) {
  try {
    assertServiceAuth(req.headers.authorization);
  } catch {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }
  const sig = req.headers['intuit-signature'] as string | undefined;
  if (!verifyIntuitSignature(rawBody, sig)) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid signature' }));
    return;
  }
  try {
    const body = JSON.parse(rawBody || '{}');
    const result = await handleQuickBooksWebhook(body, companyId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e instanceof Error ? e.message : 'Webhook error' }));
  }
}
