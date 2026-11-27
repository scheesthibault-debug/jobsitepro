import type { TimeEntry } from '../../types/domain.js';
import { pbList } from '../../pocketbase/client.js';
import { logSyncEvent } from '../../pocketbase/repositories/sync-logs.js';
import { mapTimeEntryToWagepointRow, type WagepointHoursRow } from './mapper.js';

const COLLECTION_TIME = 'time_entries';

const CSV_HEADERS = [
  'employee_id',
  'employee_name',
  'employee_email',
  'job_code',
  'job_name',
  'date',
  'regular_hours',
  'overtime_hours',
  'cost_center',
  'notes',
] as const;

function csvEscape(v: string | number) {
  const s = String(v ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function rowsToCsv(rows: WagepointHoursRow[]) {
  const lines = [CSV_HEADERS.join(',')];
  for (const r of rows) {
    lines.push(CSV_HEADERS.map((h) => csvEscape(r[h])).join(','));
  }
  return lines.join('\n');
}

/** Export heures clôturées — MVP sans champ approved dédié (clock_out requis) */
export async function buildWagepointHoursExport(companyId: string, fromDate?: string, toDate?: string) {
  let filter = `company="${companyId}" && clock_out != ""`;
  if (fromDate) filter += ` && clock_in >= "${fromDate} 00:00:00.000Z"`;
  if (toDate) filter += ` && clock_in <= "${toDate} 23:59:59.999Z"`;

  const entries = await pbList<TimeEntry>(COLLECTION_TIME, filter, 'employee,site');
  const rows: WagepointHoursRow[] = [];
  let skippedUnapproved = 0;

  for (const entry of entries) {
    if (entry.approved_for_payroll === false) {
      skippedUnapproved += 1;
      continue;
    }
    const row = mapTimeEntryToWagepointRow(entry);
    if (row) rows.push(row);
  }

  await logSyncEvent({
    company: companyId,
    provider: 'wagepoint',
    direction: 'push',
    status: 'success',
    entity_type: 'time_entry',
    message: `Export CSV ${rows.length} lignes (${skippedUnapproved} ignorées)`,
    payload: { row_count: rows.length, skipped: skippedUnapproved },
  });

  return {
    rows,
    csv: rowsToCsv(rows),
    meta: {
      row_count: rows.length,
      skipped_unapproved: skippedUnapproved,
      from: fromDate,
      to: toDate,
    },
  };
}

/** Interface prête pour API Wagepoint directe */
export interface WagepointApiProvider {
  pushHours(companyId: string, rows: WagepointHoursRow[]): Promise<{ ok: boolean; external_batch_id?: string; error?: string }>;
}

export class WagepointApiStub implements WagepointApiProvider {
  async pushHours(_companyId: string, rows: WagepointHoursRow[]) {
    // TODO: brancher API partenaire Wagepoint quand credentials disponibles
    return { ok: false, error: `API Wagepoint non configurée (${rows.length} lignes prêtes)` };
  }
}
