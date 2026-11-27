/// <reference path="../pb_data/types.d.ts" />
/**
 * Proxy OCR Gemini → service Node local (3101).
 * Contourne NPM quand /ocr/ renvoie 404 mais /api/ fonctionne déjà.
 */
const OCR_LOCAL = 'http://127.0.0.1:3101';

function forwardJson(e, res) {
  const code = res.statusCode || 502;
  if (res.json != null) return e.json(code, res.json);
  return e.json(code, { ok: false, error: (res.raw || 'OCR vide').slice(0, 200) });
}

routerAdd('GET', '/api/jobsitepro/ocr-health', (e) => {
  try {
    const res = $http.send({
      url: OCR_LOCAL + '/health',
      method: 'GET',
      timeout: 15,
    });
    return forwardJson(e, res);
  } catch (err) {
    return e.json(503, { ok: false, error: String(err) });
  }
});

routerAdd('POST', '/api/jobsitepro/scan-receipt', (e) => {
  try {
    const info = $apis.requestInfo(e);
    const headers = { 'content-type': 'application/json' };
    const auth = info.headers?.authorization || info.headers?.Authorization || '';
    if (auth) headers.Authorization = auth;
    const body = info.rawBody || JSON.stringify(info.data || {});
    const res = $http.send({
      url: OCR_LOCAL + '/scan-receipt',
      method: 'POST',
      headers,
      body,
      timeout: 120,
    });
    return forwardJson(e, res);
  } catch (err) {
    return e.json(503, { ok: false, manual: true, error: String(err) });
  }
});
