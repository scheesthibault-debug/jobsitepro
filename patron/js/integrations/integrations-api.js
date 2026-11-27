/**
 * Client API — services/integrations-hub (QuickBooks + Wagepoint)
 */
(function (global) {
  'use strict';

  function hubBase() {
    const api = (global.API_URL || '').replace(/\/$/, '');
    if (global.localStorage?.getItem('ct_integrations_base')) {
      return global.localStorage.getItem('ct_integrations_base').replace(/\/$/, '');
    }
    if (typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin.replace(/\/$/, '');
    }
    return api;
  }

  async function hubFetch(path, opts) {
    const base = hubBase();
    const url = `${base}/integrations${path}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(opts?.headers || {}),
    };
    if (global.authToken) headers.Authorization = global.authToken;
    const res = await fetch(url, { ...opts, headers });
    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text }; }
    if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);
    return data;
  }

  async function getStatus(companyId) {
    return hubFetch(`/v1/${encodeURIComponent(companyId)}/status`, { method: 'GET' });
  }

  async function runSync(companyId, provider, direction, entityTypes) {
    return hubFetch('/v1/sync/run', {
      method: 'POST',
      body: JSON.stringify({
        company: companyId,
        provider,
        direction,
        entity_types: entityTypes,
      }),
    });
  }

  function downloadCsv(filename, csv) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  global.ChantierTrackIntegrationsApi = {
    hubBase,
    getStatus,
    runSync,
    downloadCsv,
  };
})(typeof window !== 'undefined' ? window : global);
