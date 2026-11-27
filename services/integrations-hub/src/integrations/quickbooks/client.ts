import { config } from '../../config.js';
import type { IntegrationAccount } from '../../types/integration.js';

export class QuickBooksClient {
  constructor(
    private account: IntegrationAccount,
  ) {}

  private baseUrl() {
    const realm = this.account.realm_id;
    if (!realm) throw new Error('realm_id manquant');
    return `${config.quickbooks.apiBase(this.account.environment)}/v3/company/${realm}`;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl()}${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.account.access_token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`QuickBooks ${res.status}: ${text.slice(0, 400)}`);
    }
    return text ? (JSON.parse(text) as T) : ({} as T);
  }

  async createCustomer(payload: Record<string, unknown>) {
    const data = await this.request<{ Customer: { Id: string } }>('POST', '/customer', payload);
    return data.Customer;
  }

  async updateCustomer(id: string, payload: Record<string, unknown>) {
    const data = await this.request<{ Customer: { Id: string } }>('POST', '/customer', {
      ...payload,
      Id: id,
      sparse: true,
    });
    return data.Customer;
  }

  async createPurchase(payload: Record<string, unknown>) {
    const data = await this.request<{ Purchase: { Id: string } }>('POST', '/purchase', payload);
    return data.Purchase;
  }

  async createInvoice(payload: Record<string, unknown>) {
    const data = await this.request<{ Invoice: { Id: string } }>('POST', '/invoice', payload);
    return data.Invoice;
  }

  async getCustomer(id: string) {
    const data = await this.request<{ Customer: Record<string, unknown> }>('GET', `/customer/${id}`);
    return data.Customer;
  }

  async query(sql: string) {
    const q = encodeURIComponent(sql);
    const data = await this.request<{ QueryResponse: Record<string, unknown> }>(
      'GET',
      `/query?query=${q}`,
    );
    return data.QueryResponse;
  }
}
