export type IntegrationProvider = 'quickbooks' | 'wagepoint';
export type IntegrationEnvironment = 'sandbox' | 'production';

export type EntityType =
  | 'client'
  | 'site'
  | 'invoice'
  | 'expense'
  | 'time_entry'
  | 'employee'
  | 'payroll_journal';

export type SyncStatus = 'pending' | 'synced' | 'error' | 'skipped';
export type LogStatus = 'pending' | 'success' | 'error';
export type SyncDirection = 'push' | 'pull' | 'webhook';

export interface IntegrationAccount {
  id?: string;
  company: string;
  provider: IntegrationProvider;
  environment: IntegrationEnvironment;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  realm_id?: string;
  external_company_name?: string;
  metadata?: Record<string, unknown>;
}

export interface IntegrationMapping {
  id?: string;
  company: string;
  provider: IntegrationProvider;
  entity_type: EntityType;
  local_id: string;
  external_id?: string;
  sync_status: SyncStatus;
  last_synced_at?: string;
  raw_payload?: Record<string, unknown>;
  last_error?: string;
}

export interface SyncLog {
  id?: string;
  company: string;
  provider: IntegrationProvider;
  direction: SyncDirection;
  entity_type?: string;
  local_id?: string;
  external_id?: string;
  status: LogStatus;
  message?: string;
  payload?: Record<string, unknown>;
  created?: string;
}

export interface SyncJob {
  id: string;
  company: string;
  provider: IntegrationProvider;
  entity_type: EntityType;
  local_id: string;
  direction: 'push' | 'pull';
  attempts: number;
  maxAttempts: number;
}

export interface SyncResult {
  ok: boolean;
  entity_type: EntityType;
  local_id: string;
  external_id?: string;
  error?: string;
  skipped?: boolean;
  reason?: string;
}

export interface SyncBatchResult {
  company: string;
  provider: IntegrationProvider;
  direction: SyncDirection;
  started_at: string;
  finished_at: string;
  results: SyncResult[];
  errors: SyncLog[];
}
