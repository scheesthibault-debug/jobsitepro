import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../../config.js';
import { logSyncEvent } from '../../pocketbase/repositories/sync-logs.js';
import { enqueueJobs, buildJobs } from '../sync/sync-queue.js';

interface IntuitWebhookPayload {
  eventNotifications?: Array<{
    realmId?: string;
    dataChangeEvent?: {
      entities?: Array<{
        name?: string;
        id?: string;
        operation?: string;
      }>;
    };
  }>;
}

export function verifyIntuitSignature(payload: string, signatureHeader: string | undefined) {
  const verifier = config.quickbooks.webhookVerifier;
  if (!verifier) return true; // dev only
  if (!signatureHeader) return false;
  const hash = createHmac('sha256', verifier).update(payload).digest('base64');
  try {
    return timingSafeEqual(Buffer.from(hash), Buffer.from(signatureHeader));
  } catch {
    return false;
  }
}

const entityMap: Record<string, 'client' | 'invoice' | 'expense' | null> = {
  Customer: 'client',
  Invoice: 'invoice',
  Purchase: 'expense',
  Bill: 'expense',
};

/** MVP: enqueue pull jobs — résolution company par realm_id TODO */
export async function handleQuickBooksWebhook(body: IntuitWebhookPayload, companyId: string) {
  const jobs: ReturnType<typeof buildJobs> = [];
  for (const notif of body.eventNotifications || []) {
    const realmId = notif.realmId;
    for (const ent of notif.dataChangeEvent?.entities || []) {
      const mapped = entityMap[ent.name || ''];
      if (!mapped || !ent.id) continue;
      jobs.push(
        ...buildJobs(companyId, 'quickbooks', mapped, [`webhook:${ent.id}`], 'pull'),
      );
      await logSyncEvent({
        company: companyId,
        provider: 'quickbooks',
        direction: 'webhook',
        status: 'pending',
        entity_type: mapped,
        external_id: ent.id,
        message: `Webhook ${ent.operation} realm=${realmId}`,
        payload: { entity: ent.name, operation: ent.operation },
      });
    }
  }
  enqueueJobs(jobs);
  return { accepted: true, jobs: jobs.length };
}
