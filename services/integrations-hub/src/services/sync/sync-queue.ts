import type { EntityType, IntegrationProvider, SyncJob } from '../../types/integration.js';

const queues = new Map<string, SyncJob[]>();

function key(company: string, provider: IntegrationProvider) {
  return `${company}:${provider}`;
}

export function enqueueJobs(jobs: SyncJob[]) {
  for (const job of jobs) {
    const k = key(job.company, job.provider);
    const list = queues.get(k) || [];
    const dup = list.some(
      (j) => j.entity_type === job.entity_type && j.local_id === job.local_id && j.direction === job.direction,
    );
    if (!dup) list.push(job);
    queues.set(k, list);
  }
}

export function dequeueBatch(company: string, provider: IntegrationProvider, limit = 20): SyncJob[] {
  const k = key(company, provider);
  const list = queues.get(k) || [];
  const batch = list.splice(0, limit);
  queues.set(k, batch.length ? list : []);
  return batch;
}

export function retryJob(job: SyncJob) {
  if (job.attempts >= job.maxAttempts) return;
  job.attempts += 1;
  enqueueJobs([job]);
}

export function buildJobs(
  company: string,
  provider: IntegrationProvider,
  entityType: EntityType,
  localIds: string[],
  direction: 'push' | 'pull',
): SyncJob[] {
  return localIds.map((local_id) => ({
    id: `${entityType}:${local_id}:${direction}`,
    company,
    provider,
    entity_type: entityType,
    local_id,
    direction,
    attempts: 0,
    maxAttempts: 3,
  }));
}
