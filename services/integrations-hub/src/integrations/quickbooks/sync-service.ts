import type { Client, Expense, Invoice, TimeEntry } from '../../types/domain.js';
import type { EntityType, SyncBatchResult, SyncResult } from '../../types/integration.js';
import { pbGet, pbList } from '../../pocketbase/client.js';
import { findMapping, upsertMapping } from '../../pocketbase/repositories/mappings.js';
import { logSyncEvent } from '../../pocketbase/repositories/sync-logs.js';
import { getValidQuickBooksAccount } from '../../services/oauth/quickbooks-oauth.js';
import { buildJobs, dequeueBatch, enqueueJobs, retryJob } from '../../services/sync/sync-queue.js';
import { QuickBooksClient } from './client.js';
import {
  isExpenseSyncable,
  isInvoiceSyncable,
  isTimeEntrySyncable,
  mapClientToQbCustomer,
  mapExpenseToQbPurchase,
  mapInvoiceToQb,
  mapTimeEntryToQbTimeActivity,
} from './mappers.js';

async function resolveCustomerRef(companyId: string, clientId: string | undefined, qb: QuickBooksClient) {
  if (!clientId) return undefined;
  const existing = await findMapping(companyId, 'quickbooks', 'client', clientId);
  if (existing?.external_id) return existing.external_id;
  const client = await pbGet<Client>('clients', clientId);
  const created = await qb.createCustomer(mapClientToQbCustomer(client));
  await upsertMapping({
    company: companyId,
    provider: 'quickbooks',
    entity_type: 'client',
    local_id: clientId,
    external_id: created.Id,
    sync_status: 'synced',
    raw_payload: { DisplayName: client.nom },
  });
  return created.Id;
}

async function pushClient(companyId: string, localId: string, qb: QuickBooksClient): Promise<SyncResult> {
  const existing = await findMapping(companyId, 'quickbooks', 'client', localId);
  if (existing?.external_id) {
    return { ok: true, entity_type: 'client', local_id: localId, external_id: existing.external_id, skipped: true, reason: 'already_mapped' };
  }
  const client = await pbGet<Client>('clients', localId);
  const created = await qb.createCustomer(mapClientToQbCustomer(client));
  await upsertMapping({
    company: companyId,
    provider: 'quickbooks',
    entity_type: 'client',
    local_id: localId,
    external_id: created.Id,
    sync_status: 'synced',
    raw_payload: { DisplayName: client.nom },
  });
  return { ok: true, entity_type: 'client', local_id: localId, external_id: created.Id };
}

async function pushExpense(companyId: string, localId: string, qb: QuickBooksClient): Promise<SyncResult> {
  const existing = await findMapping(companyId, 'quickbooks', 'expense', localId);
  if (existing?.external_id) {
    return { ok: true, entity_type: 'expense', local_id: localId, external_id: existing.external_id, skipped: true, reason: 'already_mapped' };
  }
  const expense = await pbGet<Expense>('expenses', localId);
  if (!isExpenseSyncable(expense)) {
    return { ok: false, entity_type: 'expense', local_id: localId, skipped: true, reason: 'not_approved' };
  }
  const created = await qb.createPurchase(mapExpenseToQbPurchase(expense));
  await upsertMapping({
    company: companyId,
    provider: 'quickbooks',
    entity_type: 'expense',
    local_id: localId,
    external_id: created.Id,
    sync_status: 'synced',
    raw_payload: { amount: expense.amount },
  });
  return { ok: true, entity_type: 'expense', local_id: localId, external_id: created.Id };
}

async function pushInvoice(companyId: string, localId: string, qb: QuickBooksClient): Promise<SyncResult> {
  const existing = await findMapping(companyId, 'quickbooks', 'invoice', localId);
  if (existing?.external_id) {
    return { ok: true, entity_type: 'invoice', local_id: localId, external_id: existing.external_id, skipped: true, reason: 'already_mapped' };
  }
  const invoice = await pbGet<Invoice>('factures', localId);
  if (!isInvoiceSyncable(invoice)) {
    return { ok: false, entity_type: 'invoice', local_id: localId, skipped: true, reason: 'not_issued' };
  }
  const customerRef = await resolveCustomerRef(companyId, invoice.client, qb);
  if (!customerRef) {
    return { ok: false, entity_type: 'invoice', local_id: localId, error: 'client_missing' };
  }
  const created = await qb.createInvoice(mapInvoiceToQb(invoice, customerRef));
  await upsertMapping({
    company: companyId,
    provider: 'quickbooks',
    entity_type: 'invoice',
    local_id: localId,
    external_id: created.Id,
    sync_status: 'synced',
  });
  return { ok: true, entity_type: 'invoice', local_id: localId, external_id: created.Id };
}

async function pushTimeEntry(companyId: string, localId: string, qb: QuickBooksClient): Promise<SyncResult> {
  const existing = await findMapping(companyId, 'quickbooks', 'time_entry', localId);
  if (existing?.external_id) {
    return { ok: true, entity_type: 'time_entry', local_id: localId, external_id: existing.external_id, skipped: true, reason: 'already_mapped' };
  }
  const entry = await pbGet<TimeEntry>('time_entries', localId, 'employee,site');
  if (!isTimeEntrySyncable(entry)) {
    return { ok: false, entity_type: 'time_entry', local_id: localId, skipped: true, reason: 'not_approved_or_open' };
  }
  // TODO: TimeActivity API — nécessite refs Employee/Customer configurés dans QB
  const employeeName = entry.expand?.employee?.name || entry.employee;
  const payload = mapTimeEntryToQbTimeActivity(entry, employeeName);
  await upsertMapping({
    company: companyId,
    provider: 'quickbooks',
    entity_type: 'time_entry',
    local_id: localId,
    sync_status: 'pending',
    last_error: 'TimeActivity push — configurer EmployeeRef/CustomerRef QB (TODO)',
    raw_payload: payload as Record<string, unknown>,
  });
  return {
    ok: false,
    entity_type: 'time_entry',
    local_id: localId,
    skipped: true,
    reason: 'time_activity_todo',
    error: 'TimeActivity nécessite mapping employé QB',
  };
}

const pushHandlers: Record<EntityType, ((c: string, id: string, qb: QuickBooksClient) => Promise<SyncResult>) | null> = {
  client: pushClient,
  expense: pushExpense,
  invoice: pushInvoice,
  time_entry: pushTimeEntry,
  site: null,
  employee: null,
  payroll_journal: null,
};

export async function runQuickBooksPush(
  companyId: string,
  entityTypes: EntityType[] = ['client', 'expense', 'invoice', 'time_entry'],
): Promise<SyncBatchResult> {
  const started = new Date().toISOString();
  const account = await getValidQuickBooksAccount(companyId);
  const qb = new QuickBooksClient(account);
  const results: SyncResult[] = [];

  for (const entityType of entityTypes) {
    const collection =
      entityType === 'client' ? 'clients'
      : entityType === 'expense' ? 'expenses'
      : entityType === 'invoice' ? 'factures'
      : entityType === 'time_entry' ? 'time_entries'
      : null;
    if (!collection) continue;

    let filter = `company="${companyId}"`;
    if (entityType === 'expense') filter += ' && status="approved"';
    if (entityType === 'invoice') filter += ' && (statut="envoyee" || statut="payee" || statut="partielle")';
    if (entityType === 'time_entry') filter += ' && clock_out != ""';

    const rows = await pbList<{ id: string }>(collection, filter);
    enqueueJobs(buildJobs(companyId, 'quickbooks', entityType, rows.map((r) => r.id), 'push'));
  }

  const batch = dequeueBatch(companyId, 'quickbooks', 50);
  for (const job of batch) {
    const handler = pushHandlers[job.entity_type];
    if (!handler) continue;
    try {
      const result = await handler(companyId, job.local_id, qb);
      results.push(result);
      await logSyncEvent({
        company: companyId,
        provider: 'quickbooks',
        direction: 'push',
        status: result.ok ? 'success' : result.skipped ? 'pending' : 'error',
        entity_type: job.entity_type,
        local_id: job.local_id,
        external_id: result.external_id,
        message: result.error || result.reason || 'ok',
      });
      if (!result.ok && !result.skipped) retryJob(job);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ ok: false, entity_type: job.entity_type, local_id: job.local_id, error: msg });
      await upsertMapping({
        company: companyId,
        provider: 'quickbooks',
        entity_type: job.entity_type,
        local_id: job.local_id,
        sync_status: 'error',
        last_error: msg,
      });
      await logSyncEvent({
        company: companyId,
        provider: 'quickbooks',
        direction: 'push',
        status: 'error',
        entity_type: job.entity_type,
        local_id: job.local_id,
        message: msg,
      });
      retryJob(job);
    }
  }

  return {
    company: companyId,
    provider: 'quickbooks',
    direction: 'push',
    started_at: started,
    finished_at: new Date().toISOString(),
    results,
    errors: [],
  };
}
