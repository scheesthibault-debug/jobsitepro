import type { Client } from '../../types/domain.js';
import type { EntityType, SyncBatchResult, SyncResult } from '../../types/integration.js';
import { pbCreate, pbList } from '../../pocketbase/client.js';
import { findMappingByExternalId, upsertMapping } from '../../pocketbase/repositories/mappings.js';
import { logSyncEvent } from '../../pocketbase/repositories/sync-logs.js';
import { getValidQuickBooksAccount } from '../../services/oauth/quickbooks-oauth.js';
import { QuickBooksClient } from './client.js';
import { mapQbCustomerToClient } from './mappers.js';

const PAGE_SIZE = 100;

/** Récupère toutes les pages d'une entité QuickBooks via STARTPOSITION/MAXRESULTS */
async function queryAll(qb: QuickBooksClient, entity: string): Promise<Record<string, any>[]> {
  const out: Record<string, any>[] = [];
  let start = 1;
  // QuickBooks limite à 1000 résultats par requête, on pagine par PAGE_SIZE.
  for (let guard = 0; guard < 200; guard++) {
    const sql = `SELECT * FROM ${entity} STARTPOSITION ${start} MAXRESULTS ${PAGE_SIZE}`;
    const resp = (await qb.query(sql)) as Record<string, any>;
    const rows = (resp?.[entity] as Record<string, any>[]) || [];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    start += PAGE_SIZE;
  }
  return out;
}

/** Trouve un client local déjà rattaché à ce Customer QuickBooks (quickbooks_id) */
async function findLocalClientByQbId(companyId: string, qbId: string): Promise<{ id: string } | null> {
  const rows = await pbList<{ id: string }>(
    'clients',
    `company="${companyId}" && quickbooks_id="${qbId}"`,
  );
  return rows[0] || null;
}

/** Import des clients QuickBooks (Customers) → collection clients JobsitePro */
async function importClients(companyId: string, qb: QuickBooksClient): Promise<SyncResult[]> {
  const customers = await queryAll(qb, 'Customer');
  const results: SyncResult[] = [];

  for (const cust of customers) {
    const qbId = String(cust.Id || '');
    if (!qbId) continue;

    try {
      // Anti-doublon : mapping existant OU client déjà porteur du quickbooks_id
      const mapping = await findMappingByExternalId(companyId, 'quickbooks', 'client', qbId);
      const localExisting = mapping?.local_id
        ? { id: mapping.local_id }
        : await findLocalClientByQbId(companyId, qbId);

      if (localExisting?.id) {
        results.push({ ok: true, entity_type: 'client', local_id: localExisting.id, external_id: qbId, skipped: true, reason: 'already_imported' });
        continue;
      }

      const payload = mapQbCustomerToClient(cust, companyId);
      const created = (await pbCreate('clients', {
        ...payload,
        is_active: cust.Active !== false,
        notes: 'Importé de QuickBooks',
      })) as Client;

      await upsertMapping({
        company: companyId,
        provider: 'quickbooks',
        entity_type: 'client',
        local_id: created.id,
        external_id: qbId,
        sync_status: 'synced',
        raw_payload: { DisplayName: payload.nom },
      });

      await logSyncEvent({
        company: companyId,
        provider: 'quickbooks',
        direction: 'pull',
        status: 'success',
        entity_type: 'client',
        local_id: created.id,
        external_id: qbId,
        message: `Client importé: ${payload.nom}`,
      });

      results.push({ ok: true, entity_type: 'client', local_id: created.id, external_id: qbId });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await logSyncEvent({
        company: companyId,
        provider: 'quickbooks',
        direction: 'pull',
        status: 'error',
        entity_type: 'client',
        external_id: qbId,
        message: msg,
      });
      results.push({ ok: false, entity_type: 'client', local_id: '', external_id: qbId, error: msg });
    }
  }

  return results;
}

const importHandlers: Partial<Record<EntityType, (c: string, qb: QuickBooksClient) => Promise<SyncResult[]>>> = {
  client: importClients,
};

/**
 * Import (pull) des données existantes d'un compte QuickBooks vers JobsitePro.
 * MVP : clients (Customers). Extensible aux factures/dépenses ensuite.
 */
export async function runQuickBooksPull(
  companyId: string,
  entityTypes: EntityType[] = ['client'],
): Promise<SyncBatchResult> {
  const started = new Date().toISOString();
  const account = await getValidQuickBooksAccount(companyId);
  const qb = new QuickBooksClient(account);
  const results: SyncResult[] = [];

  for (const entityType of entityTypes) {
    const handler = importHandlers[entityType];
    if (!handler) continue;
    const batch = await handler(companyId, qb);
    results.push(...batch);
  }

  return {
    company: companyId,
    provider: 'quickbooks',
    direction: 'pull',
    started_at: started,
    finished_at: new Date().toISOString(),
    results,
    errors: [],
  };
}
