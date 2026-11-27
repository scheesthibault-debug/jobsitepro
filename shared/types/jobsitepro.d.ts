/** Types de référence JobsitePro — migration TypeScript future */

export type RbacRole =
  | 'admin_patron'
  | 'gestionnaire'
  | 'comptable'
  | 'contremaitre'
  | 'securite_sst'
  | 'employe'
  | 'lecture_seule';

export type PermissionAction =
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'approve'
  | 'export'
  | 'connect'
  | 'manage_roles';

export type AppModule =
  | 'chantier'
  | 'pointage'
  | 'depenses'
  | 'ocr_recus'
  | 'facturation'
  | 'paie_export'
  | 'crm'
  | 'integrations_quickbooks'
  | 'rapports'
  | 'utilisateurs'
  | 'parametres'
  | 'documents_securite';

export type QbEntityType =
  | 'Invoice'
  | 'Bill'
  | 'Purchase'
  | 'Customer'
  | 'Vendor'
  | 'Payment'
  | 'AttachmentOnly';

export interface AuthUser {
  id: string;
  company: string;
  role: 'admin' | 'employe';
  rbac_role?: RbacRole;
  email: string;
  name?: string;
}

export interface QbRouteResult {
  allowed: boolean;
  qbEntityType: QbEntityType | '';
  reason: string;
  requiresApproval: boolean;
}

export interface QuickbooksSyncRecord {
  id?: string;
  company: string;
  entity_type: string;
  local_id: string;
  quickbooks_id?: string;
  sync_direction?: 'push' | 'pull' | 'both';
  last_synced?: string;
  sync_error?: string;
}

export type IntegrationProvider = 'quickbooks' | 'wagepoint';

export interface IntegrationAccount {
  company: string;
  provider: IntegrationProvider;
  environment: 'sandbox' | 'production';
  access_token: string;
  refresh_token: string;
  expires_at: string;
  realm_id?: string;
  external_company_name?: string;
}

export interface IntegrationMapping {
  company: string;
  provider: IntegrationProvider;
  entity_type: string;
  local_id: string;
  external_id?: string;
  sync_status: 'pending' | 'synced' | 'error' | 'skipped';
  last_synced_at?: string;
  last_error?: string;
}

export interface SyncLog {
  company: string;
  provider: IntegrationProvider;
  direction: 'push' | 'pull' | 'webhook';
  status: 'pending' | 'success' | 'error';
  entity_type?: string;
  local_id?: string;
  external_id?: string;
  message?: string;
}
