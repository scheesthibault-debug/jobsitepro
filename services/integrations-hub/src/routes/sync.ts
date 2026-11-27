import type { IncomingMessage, ServerResponse } from 'node:http';
import { z } from 'zod';
import { validatePatronToken } from '../pocketbase/client.js';
import { listMappings } from '../pocketbase/repositories/mappings.js';
import { listSyncLogs } from '../pocketbase/repositories/sync-logs.js';
import { getToken } from '../pocketbase/repositories/tokens.js';
import { runQuickBooksPush } from '../integrations/quickbooks/sync-service.js';
import { runQuickBooksPull } from '../integrations/quickbooks/import-service.js';
import { buildWagepointHoursExport } from '../integrations/wagepoint/export-csv.js';
import type { EntityType } from '../types/integration.js';

const syncBodySchema = z.object({
  company: z.string().min(8),
  provider: z.enum(['quickbooks', 'wagepoint']),
  direction: z.enum(['push', 'pull']).default('push'),
  entity_types: z.array(z.string()).optional(),
});

export async function handleSyncStatus(req: IncomingMessage, res: ServerResponse, companyId: string) {
  const user = await validatePatronToken(req.headers.authorization);
  if (!user || user.company !== companyId) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Accès refusé' }));
    return;
  }
  const [qbToken, wpToken, qbLogs, wpLogs, qbMappings] = await Promise.all([
    getToken(companyId, 'quickbooks').catch(() => null),
    getToken(companyId, 'wagepoint').catch(() => null),
    listSyncLogs(companyId, 'quickbooks', 15).catch(() => []),
    listSyncLogs(companyId, 'wagepoint', 15).catch(() => []),
    listMappings(companyId, 'quickbooks', 20).catch(() => []),
  ]);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    quickbooks: {
      connected: !!qbToken?.access_token,
      realm_id: qbToken?.realm_id,
      company_name: qbToken?.external_company_name,
      environment: qbToken?.environment,
      expires_at: qbToken?.expires_at,
      last_logs: qbLogs,
      mappings_preview: qbMappings,
    },
    wagepoint: {
      connected: !!wpToken?.access_token || !!wpToken?.metadata,
      last_logs: wpLogs,
    },
  }));
}

export async function handleSyncRun(req: IncomingMessage, res: ServerResponse, body: unknown) {
  const user = await validatePatronToken(req.headers.authorization);
  const parsed = syncBodySchema.safeParse(body);
  if (!parsed.success) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: parsed.error.message }));
    return;
  }
  const { company, provider, direction, entity_types } = parsed.data;
  if (!user || user.company !== company) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Accès refusé' }));
    return;
  }
  try {
    if (provider === 'quickbooks' && direction === 'push') {
      const types = (entity_types || ['client', 'expense', 'invoice', 'time_entry']) as EntityType[];
      const result = await runQuickBooksPush(company, types);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }
    if (provider === 'quickbooks' && direction === 'pull') {
      const types = (entity_types || ['client']) as EntityType[];
      const result = await runQuickBooksPull(company, types);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }
    if (provider === 'wagepoint' && direction === 'push') {
      const exportData = await buildWagepointHoursExport(company);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        provider: 'wagepoint',
        direction: 'push',
        format: 'csv',
        csv: exportData.csv,
        meta: exportData.meta,
        preview: exportData.rows.slice(0, 20),
      }));
      return;
    }
    res.writeHead(501, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Direction/provider non implémenté en MVP', provider, direction }));
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e instanceof Error ? e.message : 'Erreur sync' }));
  }
}
