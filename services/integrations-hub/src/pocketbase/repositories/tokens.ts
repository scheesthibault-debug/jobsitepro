import type { IntegrationAccount, IntegrationProvider } from '../../types/integration.js';
import { pbCreate, pbList, pbPatch } from '../client.js';

const COL = 'integration_tokens';

interface TokenRow {
  id: string;
  company: string;
  provider: IntegrationProvider;
  environment: 'sandbox' | 'production';
  access_token?: string;
  refresh_token?: string;
  expires_at?: string;
  realm_id?: string;
  external_company_name?: string;
  metadata?: Record<string, unknown>;
}

function toAccount(row: TokenRow): IntegrationAccount {
  return {
    id: row.id,
    company: row.company,
    provider: row.provider,
    environment: row.environment,
    access_token: row.access_token || '',
    refresh_token: row.refresh_token || '',
    expires_at: row.expires_at || '',
    realm_id: row.realm_id,
    external_company_name: row.external_company_name,
    metadata: row.metadata,
  };
}

export async function getToken(companyId: string, provider: IntegrationProvider): Promise<IntegrationAccount | null> {
  const rows = await pbList<TokenRow>(COL, `company="${companyId}" && provider="${provider}"`);
  return rows[0] ? toAccount(rows[0]) : null;
}

export async function upsertToken(account: Omit<IntegrationAccount, 'id'> & { id?: string }) {
  const existing = await getToken(account.company, account.provider);
  const body = {
    company: account.company,
    provider: account.provider,
    environment: account.environment,
    access_token: account.access_token,
    refresh_token: account.refresh_token,
    expires_at: account.expires_at,
    realm_id: account.realm_id || '',
    external_company_name: account.external_company_name || '',
    metadata: account.metadata || {},
  };
  if (existing?.id) {
    await pbPatch(COL, existing.id, body);
    return { ...existing, ...account, id: existing.id };
  }
  const created = (await pbCreate(COL, body)) as TokenRow;
  return toAccount(created);
}

export async function deleteToken(companyId: string, provider: IntegrationProvider) {
  const existing = await getToken(companyId, provider);
  if (!existing?.id) return;
  await pbPatch(COL, existing.id, {
    access_token: '',
    refresh_token: '',
    expires_at: '',
    realm_id: '',
    external_company_name: '',
    metadata: {},
  });
}
