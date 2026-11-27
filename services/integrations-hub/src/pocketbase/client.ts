import { config } from '../config.js';

export interface PbUser {
  id: string;
  company: string;
  role: string;
  email?: string;
}

export async function validatePatronToken(authorization: string | undefined): Promise<PbUser | null> {
  if (!authorization?.startsWith('Bearer ')) return null;
  try {
    const res = await fetch(`${config.pocketbaseUrl}/api/collections/users/auth-refresh`, {
      headers: { Authorization: authorization },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { record?: PbUser };
    const user = data.record;
    if (!user?.id) return null;
    const role = String(user.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'patron') return null;
    return user;
  } catch {
    return null;
  }
}

export function assertServiceAuth(header: string | undefined) {
  if (!config.serviceSecret) return;
  const token = header?.replace(/^Bearer\s+/i, '') || '';
  if (token !== config.serviceSecret) {
    throw new Error('Non autorisé (service secret)');
  }
}

export async function pbAdminFetch(path: string, init?: RequestInit): Promise<unknown> {
  if (!config.pocketbaseAdminToken) {
    throw new Error('POCKETBASE_ADMIN_TOKEN non configuré');
  }
  const res = await fetch(`${config.pocketbaseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: config.pocketbaseAdminToken,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PocketBase ${res.status}: ${text.slice(0, 300)}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export async function pbList<T>(collection: string, filter: string, expand = '', sort = '-created') {
  const q = new URLSearchParams({ perPage: '500', sort });
  if (filter) q.set('filter', filter);
  if (expand) q.set('expand', expand);
  const data = (await pbAdminFetch(`/api/collections/${collection}/records?${q}`)) as { items: T[] };
  return data.items || [];
}

export async function pbGet<T>(collection: string, id: string, expand = '') {
  const q = expand ? `?expand=${encodeURIComponent(expand)}` : '';
  return (await pbAdminFetch(`/api/collections/${collection}/records/${id}${q}`)) as T;
}

export async function pbCreate(collection: string, body: Record<string, unknown>) {
  return pbAdminFetch(`/api/collections/${collection}/records`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function pbPatch(collection: string, id: string, body: Record<string, unknown>) {
  return pbAdminFetch(`/api/collections/${collection}/records/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}
