import type { EntityType, IntegrationMapping, IntegrationProvider, SyncStatus } from '../../types/integration.js';
import { pbCreate, pbList, pbPatch } from '../client.js';

const COL = 'integration_mappings';

export async function findMapping(
  companyId: string,
  provider: IntegrationProvider,
  entityType: EntityType,
  localId: string,
): Promise<IntegrationMapping | null> {
  const rows = await pbList<IntegrationMapping>(
    COL,
    `company="${companyId}" && provider="${provider}" && entity_type="${entityType}" && local_id="${localId}"`,
  );
  return rows[0] || null;
}

export async function findMappingByExternalId(
  companyId: string,
  provider: IntegrationProvider,
  entityType: EntityType,
  externalId: string,
): Promise<IntegrationMapping | null> {
  const rows = await pbList<IntegrationMapping>(
    COL,
    `company="${companyId}" && provider="${provider}" && entity_type="${entityType}" && external_id="${externalId}"`,
  );
  return rows[0] || null;
}

export async function upsertMapping(input: {
  company: string;
  provider: IntegrationProvider;
  entity_type: EntityType;
  local_id: string;
  external_id?: string;
  sync_status: SyncStatus;
  last_synced_at?: string;
  raw_payload?: Record<string, unknown>;
  last_error?: string;
}) {
  const existing = await findMapping(input.company, input.provider, input.entity_type, input.local_id);
  const body = {
    ...input,
    last_synced_at: input.last_synced_at || new Date().toISOString(),
    raw_payload: input.raw_payload || {},
    last_error: input.last_error || '',
  };
  if (existing?.id) {
    await pbPatch(COL, existing.id, body);
    return { ...existing, ...body };
  }
  return (await pbCreate(COL, body)) as IntegrationMapping;
}

export async function listMappings(companyId: string, provider: IntegrationProvider, limit = 50) {
  return pbList<IntegrationMapping>(
    COL,
    `company="${companyId}" && provider="${provider}"`,
    '',
    '-updated',
  ).then((rows) => rows.slice(0, limit));
}
