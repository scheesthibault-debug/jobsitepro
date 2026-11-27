/**
 * JobsitePro employé — scan reçu (caméra / galerie → proxy OCR)
 */
(function (global) {
  'use strict';

  const DEFAULT_OCR_PATH = '/api/jobsitepro/scan-receipt';
  const DEFAULT_OCR_HEALTH = '/api/jobsitepro/ocr-health';
  const LEGACY_OCR_PATH = '/ocr/scan-receipt';
  const LOCAL_OCR_SCAN = 'http://127.0.0.1:3101/scan-receipt';
  const OCR_TIMEOUT_MS = 55000;
  const HALLUCINATED_AMOUNTS = new Set([24.99, 3.49, 19.99, 29.99, 9.99, 49.99]);

  function isPlausibleVendorClient(name) {
    const v = String(name || '').trim();
    if (v.length < 3) return false;
    if (/[{}\[\]<>|\\^`~]/.test(v)) return false;
    if (/^(total|subtotal|party\s*name|server|trans)\b/i.test(v)) return false;
    if (/[0-9]{2,}[a-zA-Z]|[a-zA-Z][0-9]{2,}[a-zA-Z0-9-]{2,}/.test(v)) return false;
    const letters = (v.match(/[A-Za-zÀ-ÿ]/g) || []).length;
    return letters >= 3 && letters / v.length >= 0.45;
  }

  function sanitizeOcrData(data) {
    if (!data || typeof data !== 'object') return data;
    const out = { ...data };
    const amt = out.amount != null ? Math.round(Number(out.amount) * 100) / 100 : null;
    const tax = out.tax_amount != null ? Math.round(Number(out.tax_amount) * 100) / 100 : null;
    if (amt != null && HALLUCINATED_AMOUNTS.has(amt)) out.amount = null;
    if (tax != null && HALLUCINATED_AMOUNTS.has(tax)) out.tax_amount = null;
    if (!isPlausibleVendorClient(out.vendor)) {
      const bad = out.vendor;
      out.vendor = null;
      if (out.description === bad || !isPlausibleVendorClient(out.description)) out.description = null;
    }
    if (out.expense_date) {
      const d = new Date(`${out.expense_date}T12:00:00`);
      const now = new Date();
      if (!Number.isFinite(d.getTime()) || d.getFullYear() < 2015 || d > now) out.expense_date = null;
    }
    return out;
  }

  /** URL OCR sur la machine qui héberge le service (pas 127.0.0.1 depuis un téléphone en Wi‑Fi) */
  function localOcrScanUrl() {
    try {
      const loc = global.location;
      const host = loc?.hostname || '';
      const proto = loc?.protocol === 'https:' ? 'https:' : 'http:';
      if (!host || host === 'localhost' || host === '127.0.0.1') {
        return LOCAL_OCR_SCAN;
      }
      if (isLocalDevHost(host)) {
        return `${proto}//${host}:3101/scan-receipt`;
      }
    } catch { /* ignore */ }
    return LOCAL_OCR_SCAN;
  }

  function readStoredOcrBase() {
    const stored = (localStorage.getItem('ct_ocr_url') || '').trim().replace(/\/$/, '');
    if (!stored) return '';
    if (stored.includes('scan-receipt')) return stored;
    if (stored.endsWith('/ocr')) return `${stored}/scan-receipt`;
    return stored + LEGACY_OCR_PATH;
  }

  function isLocalDevHost(hostname) {
    if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1') return true;
    if (/^192\.168\.\d+\.\d+$/.test(hostname)) return true;
    if (/^10\.\d+\.\d+\.\d+$/.test(hostname)) return true;
    const m = String(hostname).match(/^172\.(\d+)\./);
    if (m) {
      const n = +m[1];
      return n >= 16 && n <= 31;
    }
    return false;
  }
  const MAX_OCR_DIM = 2200;
  const OCR_JPEG_QUALITY = 0.86;
  const MAX_UPLOAD_BYTES = 1500 * 1024;

  function resolveOcrUrl(apiBase) {
    const fromStore = readStoredOcrBase();
    if (fromStore) return fromStore;
    if (typeof global.location !== 'undefined' && global.location?.origin) {
      const host = global.location.hostname || '';
      if (isLocalDevHost(host)) return localOcrScanUrl();
      if (global.location.protocol === 'https:') {
        return global.location.origin.replace(/\/$/, '') + DEFAULT_OCR_PATH;
      }
      return global.location.origin.replace(/\/$/, '') + DEFAULT_OCR_PATH;
    }
    let base = (apiBase || '').trim().replace(/\/$/, '');
    try {
      if (typeof global.API_URL === 'string' && global.API_URL) base = global.API_URL.replace(/\/$/, '');
      else base = (localStorage.getItem('ct_api_url') || base).replace(/\/$/, '');
    } catch { /* ignore */ }
    base = base.replace(/\/api\/?$/, '');
    try {
      const u = new URL(base.includes('://') ? base : `https://${base}`);
      return u.origin + DEFAULT_OCR_PATH;
    } catch {
      return base ? base + DEFAULT_OCR_PATH : DEFAULT_OCR_PATH;
    }
  }

  function listOcrScanUrls(apiBase) {
    const out = [];
    const add = (url) => {
      const u = (url || '').trim();
      if (!u || out.includes(u)) return;
      out.push(u);
    };
    try {
      const host = global.location?.hostname || '';
      if (isLocalDevHost(host)) {
        add(localOcrScanUrl());
        if (host !== 'localhost' && host !== '127.0.0.1') {
          add(LOCAL_OCR_SCAN);
          add('http://localhost:3101/scan-receipt');
        }
      }
    } catch { /* ignore */ }
    try {
      if (global.location?.origin) {
        const o = global.location.origin.replace(/\/$/, '');
        add(o + DEFAULT_OCR_PATH);
        add(o + LEGACY_OCR_PATH);
      }
    } catch { /* ignore */ }
    const fromStore = readStoredOcrBase();
    if (fromStore) add(fromStore);
    add(resolveOcrUrl(apiBase));
    try {
      const loc = new URL(global.location.href);
      if (loc.hostname && loc.port !== '8888') {
        add(`${loc.protocol}//${loc.hostname}:8888${DEFAULT_OCR_PATH}`);
        add(`${loc.protocol}//${loc.hostname}:8888${LEGACY_OCR_PATH}`);
      }
    } catch { /* ignore */ }
    try {
      let base = (apiBase || global.API_URL || '').replace(/\/api\/?$/, '').replace(/\/$/, '');
      if (base) {
        const u = new URL(base.includes('://') ? base : `https://${base}`);
        add(u.origin + DEFAULT_OCR_PATH);
        if (u.port === '8090') add(`${u.protocol}//${u.hostname}:8888${DEFAULT_OCR_PATH}`);
        add(u.origin + LEGACY_OCR_PATH);
      }
    } catch { /* ignore */ }
    return out;
  }

  function scanUrlToHealth(scanUrl) {
    if (scanUrl.includes('/api/jobsitepro/scan-receipt')) {
      return scanUrl.replace('/scan-receipt', '/ocr-health');
    }
    if (scanUrl.includes('scan-receipt')) return scanUrl.replace(/\/scan-receipt\/?$/, '/health');
    return scanUrl.replace(/\/$/, '') + '/ocr/health';
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  function mimeFromFile(file) {
    if (file?.type && file.type.startsWith('image/')) return file.type;
    return 'image/jpeg';
  }

  /** Réduit la taille des photos mobile avant envoi OCR (évite timeout nginx). */
  function compressImageFile(file) {
    if (!file?.type?.startsWith('image/') || typeof document === 'undefined') {
      return Promise.resolve(file);
    }
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        const max = MAX_OCR_DIM;
        if (width <= max && height <= max && file.size <= MAX_UPLOAD_BYTES) {
          resolve(file);
          return;
        }
        const scale = Math.min(1, max / Math.max(width, height));
        width = Math.round(width * scale);
        height = Math.round(height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const tryBlob = (quality) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                resolve(file);
                return;
              }
              if (blob.size > MAX_UPLOAD_BYTES && quality > 0.45) {
                tryBlob(quality - 0.12);
                return;
              }
              resolve(new File([blob], file.name || 'receipt.jpg', { type: 'image/jpeg' }));
            },
            'image/jpeg',
            quality
          );
        };
        tryBlob(OCR_JPEG_QUALITY);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(file);
      };
      img.src = url;
    });
  }

  let activeAbort = null;

  function abortActiveScan() {
    if (activeAbort) {
      activeAbort.abort();
      activeAbort = null;
    }
  }

  /**
   * @returns {Promise<{ok:boolean, data?:object, manual?:boolean, error?:string}>}
   */
  function ocrHealthUrl(apiBase) {
    return scanUrlToHealth(resolveOcrUrl(apiBase));
  }

  async function fetchOcrHealth(scanUrl) {
    const url = scanUrlToHealth(scanUrl);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    try {
      const res = await fetch(url, { method: 'GET', signal: ctrl.signal, cache: 'no-store' });
      if (!res.ok) return null;
      try {
        const data = await res.json();
        if (data.ok === true && (data.gemini === true || data.ocrspace === true || data.claude === true)) {
          return scanUrl;
        }
        if (data.ok === true) return scanUrl;
      } catch {
        return scanUrl;
      }
    } catch {
      return null;
    } finally {
      clearTimeout(t);
    }
    return null;
  }

  /** Vérifie que le proxy OCR répond avant d’envoyer la photo (évite spinner infini). */
  async function probeOcrService(apiBase) {
    for (const scanUrl of listOcrScanUrls(apiBase)) {
      const ok = await fetchOcrHealth(scanUrl);
      if (ok) return true;
    }
    return false;
  }

  async function pickWorkingOcrScanUrl(apiBase) {
    for (const scanUrl of listOcrScanUrls(apiBase)) {
      const ok = await fetchOcrHealth(scanUrl);
      if (ok) return scanUrl;
    }
    return resolveOcrUrl(apiBase);
  }

  async function scanReceiptFile(file, authToken, apiBase) {
    abortActiveScan();
    const controller = new AbortController();
    activeAbort = controller;
    const timer = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS);

    try {
      const prepared = await compressImageFile(file);
      const b64 = await fileToBase64(prepared);
      const urls = listOcrScanUrls(apiBase);
      const headers = { 'Content-Type': 'application/json' };
      if (authToken) {
        headers.Authorization = authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`;
      }
      const body = JSON.stringify({ imageBase64: b64, mimeType: mimeFromFile(prepared) });
      let lastStatus = '';
      let lastErr = {};
      for (const url of urls) {
        const res = await fetch(url, {
          method: 'POST',
          headers,
          signal: controller.signal,
          body,
        });
        if (res.status === 404 && urls.indexOf(url) < urls.length - 1) {
          lastStatus = '404';
          continue;
        }
        if (!res.ok) {
          try { lastErr = await res.json(); } catch { lastErr = {}; }
          lastStatus = String(res.status);
          if (res.status === 404 && urls.indexOf(url) < urls.length - 1) continue;
          return {
            ok: false,
            error: lastErr.error || `HTTP ${res.status}`,
            code: lastErr.code || (res.status === 401 ? 'auth' : undefined),
          };
        }
        const data = await res.json();
        try { localStorage.setItem('ct_ocr_url', url.replace(/\/scan-receipt\/?$/, '')); } catch { /* ignore */ }
        return data;
      }
      return {
        ok: false,
        error: lastErr.error || (lastStatus ? `HTTP ${lastStatus}` : 'ocr_unavailable'),
        manual: true,
      };
    } catch (e) {
      if (e?.name === 'AbortError') {
        return { ok: false, manual: true, error: 'timeout' };
      }
      const msg = e?.message || 'network';
      const hint = msg === 'Failed to fetch' ? 'fetch_blocked' : msg;
      return { ok: false, manual: true, error: hint };
    } finally {
      clearTimeout(timer);
      if (activeAbort === controller) activeAbort = null;
    }
  }

  function mapCategoryToSelect(cat) {
    const m = { fuel: 'fuel', material: 'material', tool: 'tool', food: 'food', other: 'other' };
    return m[cat] || 'other';
  }

  function fmtMoney(n) {
    if (n == null || Number.isNaN(n)) return '–';
    return Number(n).toFixed(2) + ' $';
  }

  /** Harmonise total / taxes / HT avant remplissage du formulaire */
  function resolveOcrAmounts(data) {
    if (!data) return { amount: null, tax: null, ht: null };
    let amount = data.amount != null ? Number(data.amount) : null;
    let tax = data.tax_amount != null ? Number(data.tax_amount)
      : (data.taxes != null ? Number(data.taxes) : null);
    let ht = data.amount_ht != null ? Number(data.amount_ht) : null;
    const tps = data.tps != null ? Number(data.tps) : null;
    const tvq = data.tvq != null ? Number(data.tvq) : null;
    if ((tax == null || tax === 0) && (tps != null || tvq != null)) {
      tax = Math.round(((tps || 0) + (tvq || 0)) * 100) / 100;
    }
    if (ht != null && tax != null) {
      const ttc = Math.round((ht + tax) * 100) / 100;
      if (amount == null || amount <= ht + 0.01) amount = ttc;
    }
    if ((tax == null || tax === 0) && amount != null && ht != null && amount > ht + 0.01) {
      tax = Math.round((amount - ht) * 100) / 100;
    }
    if (ht == null && amount != null && tax != null && amount > tax + 0.01) {
      ht = Math.round((amount - tax) * 100) / 100;
    }
    return { amount, tax, ht };
  }

  /** Vide tous les champs OCR avant un nouveau remplissage (évite mélange entre scans) */
  function clearOcrFormFields(prefix) {
    const ids = prefix === 'ss'
      ? ['ss-vendor', 'ss-amount', 'ss-tax', 'ss-date', 'ss-desc']
      : ['exp-vendor', 'exp-amount', 'exp-tax', 'exp-date', 'exp-desc'];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
  }

  function applyOcrToForm(data) {
    clearOcrFormFields('exp');
    if (!data) return false;
    data = sanitizeOcrData(data);
    const { amount, tax } = resolveOcrAmounts(data);
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val != null ? String(val) : '';
    };
    set('exp-vendor', data.vendor || '');
    set('exp-amount', amount != null ? amount.toFixed(2) : '');
    set('exp-tax', tax != null && tax > 0 ? tax.toFixed(2) : '');
    set('exp-date', data.expense_date || '');
    set('exp-desc', data.description || data.vendor || '');
    if (data.category) {
      const sel = document.getElementById('exp-category');
      if (sel) sel.value = mapCategoryToSelect(data.category);
      if (typeof global.onExpenseCategoryChange === 'function') global.onExpenseCategoryChange();
    }
    renderOcrSummary(data);
    return !!(data.vendor && data.amount > 0);
  }

  function renderOcrSummary(data) {
    const box = document.getElementById('exp-ocr-summary');
    if (!box || !data) return;
    const fr = (typeof global.lang !== 'undefined' && global.lang === 'fr');
    const taxDetail =
      data.tps != null && data.tvq != null
        ? `TPS ${fmtMoney(data.tps)} · TVQ ${fmtMoney(data.tvq)}`
        : data.tax_amount != null
          ? (fr ? 'Taxes ' : 'Tax ') + fmtMoney(data.tax_amount)
          : '';
    const lines = [
      `<strong>${fr ? 'Magasin' : 'Store'}:</strong> ${data.vendor || '–'}`,
      `<strong>${fr ? 'Total TTC' : 'Total'}:</strong> ${fmtMoney(data.amount)}`,
      taxDetail ? `<strong>${fr ? 'Taxes' : 'Taxes'}:</strong> ${taxDetail}` : '',
      data.amount_ht != null ? `<strong>${fr ? 'Sous-total HT' : 'Subtotal'}:</strong> ${fmtMoney(data.amount_ht)}` : '',
      data.expense_date ? `<strong>${fr ? 'Date' : 'Date'}:</strong> ${data.expense_date}` : '',
      data.invoice_number ? `<strong>${fr ? 'N° facture' : 'Invoice'}:</strong> ${data.invoice_number}` : '',
      data.payment_method ? `<strong>${fr ? 'Paiement' : 'Payment'}:</strong> ${data.payment_method}` : '',
    ].filter(Boolean);
    box.style.display = 'block';
    box.className = 'exp-ocr-summary exp-ocr-summary-ok';
    box.innerHTML = `<div class="exp-ocr-summary-title"><i class="ti ti-scan"></i> ${fr ? 'Reçu analysé automatiquement' : 'Receipt scanned automatically'}</div>${lines.map(l => `<div class="exp-ocr-summary-line">${l}</div>`).join('')}${renderLineItemsHtml(data.line_items, fr)}`;
  }

  /** Liste les articles (lignes d'achat) extraits du ticket */
  function renderLineItemsHtml(items, fr) {
    if (!Array.isArray(items) || !items.length) return '';
    const rows = items.slice(0, 20).map((it) => {
      const qty = it.quantity != null ? `${it.quantity}× ` : '';
      const price = it.total != null ? fmtMoney(it.total) : (it.unit_price != null ? fmtMoney(it.unit_price) : '');
      return `<div class="exp-ocr-summary-line" style="display:flex;justify-content:space-between;gap:8px">
        <span style="opacity:.9">${qty}${String(it.description || '').slice(0, 60)}</span>
        <span style="white-space:nowrap">${price}</span>
      </div>`;
    }).join('');
    return `<div class="exp-ocr-summary-line" style="margin-top:6px;font-weight:600">${fr ? 'Détail du ticket' : 'Receipt detail'} (${items.length})</div>${rows}`;
  }

  function clearOcrSummary() {
    const box = document.getElementById('exp-ocr-summary');
    if (box) {
      box.style.display = 'none';
      box.innerHTML = '';
      box.className = 'exp-ocr-summary';
    }
  }

  /** Mode « photo seulement » — champs à remplir à la main */
  function showPhotoOnlySummary() {
    const box = document.getElementById('exp-ocr-summary');
    if (!box) return;
    const fr = (typeof global.lang !== 'undefined' && global.lang === 'fr');
    box.style.display = 'block';
    box.className = 'exp-ocr-summary exp-ocr-summary-photo';
    box.innerHTML = `<div class="exp-ocr-summary-title"><i class="ti ti-camera"></i> ${fr ? 'Photo enregistrée' : 'Photo saved'}</div>
      <div class="exp-ocr-summary-line">${fr ? 'Remplissez vous-même : magasin, montant TTC, taxes et date.' : 'Fill in yourself: store, total, tax and date.'}</div>
      <div class="exp-ocr-summary-line" style="opacity:.85">${fr ? 'Sans Internet ou en chantier — la photo sera jointe à la dépense.' : 'No Internet or on site — photo will be attached to the expense.'}</div>`;
  }

  function showOcrErrorSummary(message, missing) {
    const box = document.getElementById('exp-ocr-summary');
    if (!box) return;
    const fr = (typeof global.lang !== 'undefined' && global.lang === 'fr');
    const miss = (missing || []).map(m => {
      if (m === 'fournisseur') return fr ? 'magasin' : 'store';
      if (m === 'montant_ttc') return fr ? 'montant total' : 'total amount';
      return m;
    }).join(', ');
    box.style.display = 'block';
    box.className = 'exp-ocr-summary exp-ocr-summary-err';
    box.innerHTML = `<div class="exp-ocr-summary-title"><i class="ti ti-alert-triangle"></i> ${fr ? 'Scan incomplet' : 'Incomplete scan'}</div>
      <div class="exp-ocr-summary-line">${message}</div>
      ${miss ? `<div class="exp-ocr-summary-line">${fr ? 'Manque' : 'Missing'}: ${miss}</div>` : ''}
      <div class="exp-ocr-summary-line" style="margin-top:6px">${fr ? 'Reprenez une photo plus nette (reçu à plat, bonne lumière).' : 'Take a clearer photo (flat receipt, good light).'}</div>`;
  }

  function humanizeOcrError(err, lang) {
    const L = lang === 'fr';
    if (err === 'parse_failed' || (typeof err === 'string' && err.includes('Lecture automatique'))) {
      return L
        ? 'Lecture automatique échouée — remplissez manuellement'
        : 'Automatic read failed — fill in manually';
    }
    if (!err || err === 'ocr_unavailable') {
      return L
        ? 'Service OCR indisponible. Lancez start-local.ps1 (port 3101) sur le PC.'
        : 'OCR service unavailable. Run start-local.ps1 on port 3101.';
    }
    if (err === 'fetch_blocked' || err === 'Failed to fetch' || err === 'network') {
      try {
        const h = global.location?.hostname || '';
        if (h === 'localhost' || h === '127.0.0.1') {
          return L
            ? 'OCR local injoignable — dans services/receipt-ocr : .\\start-local.ps1 (Gemini dans .env)'
            : 'Local OCR unreachable — run services/receipt-ocr/start-local.ps1';
        }
        if (isLocalDevHost(h)) {
          return L
            ? `OCR sur le PC : lancez start-local.ps1 puis scan via http://${h}:3101 (même Wi‑Fi)`
            : `Run OCR on PC: start-local.ps1, then use http://${h}:3101`;
        }
      } catch { /* ignore */ }
      return L
        ? 'Scan bloqué (réseau/CORS) — proxy /api/jobsitepro/ sur le serveur ou OCR local'
        : 'Scan blocked (network/CORS) — configure server proxy or local OCR';
    }
    if (String(err).startsWith('HTTP')) return L ? `Service OCR (${err})` : `OCR (${err})`;
    return err;
  }

  global.ChantierTrackExpenseScan = {
    scanReceiptFile,
    probeOcrService,
    pickWorkingOcrScanUrl,
    listOcrScanUrls,
    localOcrScanUrl,
    humanizeOcrError,
    sanitizeOcrData,
    resolveOcrAmounts,
    clearOcrFormFields,
    applyOcrToForm,
    resolveOcrUrl,
    fileToBase64,
    compressImageFile,
    abortActiveScan,
    renderOcrSummary,
    clearOcrSummary,
    showOcrErrorSummary,
    showPhotoOnlySummary,
    OCR_TIMEOUT_MS,
  };
})(typeof window !== 'undefined' ? window : global);
