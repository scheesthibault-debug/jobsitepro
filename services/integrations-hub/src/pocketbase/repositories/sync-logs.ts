import type { IntegrationProvider, LogStatus, SyncDirection, SyncLog } from '../../types/integration.js';
import { pbCreate, pbList } from '../client.js';

const COL = 'sync_logs';

export async function writeSyncLog(log: Omit<SyncLog, 'id' | 'created'>) {
  return (await pbCreate(COL, {
    ...log,
    payload: log.payload || {},
    message: log.message || '',
    entity_type: log.entity_type || '',
    local_id: log.local_id || '',
    external_id: log.external_id || '',
  })) as SyncLog;
}

export async function listSyncLogs(companyId: string, provider?: IntegrationProvider, limit = 30) {
  let filter = `company="${companyId}"`;
  if (provider) filter += ` && provider="${provider}"`;
  const rows = await pbList<SyncLog>(COL, filter, '', '-created');
  return rows.slice(0, limit);
}

export async function logSyncEvent(opts: {
  company: string;
  provider: IntegrationProvider;
  direction: SyncDirection;
  status: LogStatus;
  entity_type?: string;
  local_id?: string;
  external_id?: string;
  message?: string;
  payload?: Record<string, unknown>;
}) {
  return writeSyncLog(opts);
}
