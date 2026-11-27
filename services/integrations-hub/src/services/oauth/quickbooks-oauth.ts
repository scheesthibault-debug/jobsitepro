import { config } from '../../config.js';
import type { IntegrationAccount } from '../../types/integration.js';
import { getToken, upsertToken } from '../../pocketbase/repositories/tokens.js';

interface IntuitTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type?: string;
  x_refresh_token_expires_in?: number;
}

function basicAuth() {
  const raw = `${config.quickbooks.clientId}:${config.quickbooks.clientSecret}`;
  return `Basic ${Buffer.from(raw).toString('base64')}`;
}

function expiresAtIso(expiresInSec: number) {
  return new Date(Date.now() + expiresInSec * 1000).toISOString();
}

export async function exchangeAuthorizationCode(code: string, realmId: string, companyId: string) {
  const redirectUri = config.quickbooks.redirectUri;
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });
  const res = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: basicAuth(),
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Intuit token exchange failed: ${text.slice(0, 200)}`);
  }
  const tok = (await res.json()) as IntuitTokenResponse;
  let companyName = '';
  try {
    companyName = await fetchQuickBooksCompanyName(tok.access_token, realmId, config.quickbooks.environment);
  } catch {
    /* optional */
  }
  return upsertToken({
    company: companyId,
    provider: 'quickbooks',
    environment: config.quickbooks.environment,
    access_token: tok.access_token,
    refresh_token: tok.refresh_token,
    expires_at: expiresAtIso(tok.expires_in || 3600),
    realm_id: realmId,
    external_company_name: companyName,
    metadata: { token_type: tok.token_type },
  });
}

export async function refreshQuickBooksToken(account: IntegrationAccount): Promise<IntegrationAccount> {
  if (!account.refresh_token) throw new Error('refresh_token manquant');
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: account.refresh_token,
  });
  const res = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: basicAuth(),
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Intuit refresh failed: ${text.slice(0, 200)}`);
  }
  const tok = (await res.json()) as IntuitTokenResponse;
  return upsertToken({
    ...account,
    access_token: tok.access_token,
    refresh_token: tok.refresh_token || account.refresh_token,
    expires_at: expiresAtIso(tok.expires_in || 3600),
  });
}

export async function getValidQuickBooksAccount(companyId: string): Promise<IntegrationAccount> {
  const account = await getToken(companyId, 'quickbooks');
  if (!account?.access_token) throw new Error('QuickBooks non connecté');
  if (!account.realm_id) throw new Error('realm_id QuickBooks manquant');
  const expires = account.expires_at ? new Date(account.expires_at).getTime() : 0;
  const bufferMs = 5 * 60 * 1000;
  if (expires && Date.now() > expires - bufferMs) {
    return refreshQuickBooksToken(account);
  }
  return account;
}

async function fetchQuickBooksCompanyName(
  accessToken: string,
  realmId: string,
  env: 'sandbox' | 'production',
) {
  const base = config.quickbooks.apiBase(env);
  const res = await fetch(`${base}/v3/company/${realmId}/companyinfo/${realmId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) return '';
  const data = (await res.json()) as { CompanyInfo?: { CompanyName?: string } };
  return data.CompanyInfo?.CompanyName || '';
}
