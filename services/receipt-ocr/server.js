#!/usr/bin/env node
/**
 * JobsitePro — Scan reçu (clé API côté serveur uniquement)
 * Providers gratuits recommandés : gemini (Google AI Studio) ou ocrspace
 * Nginx: location /ocr/ → http://127.0.0.1:3101/
 */
try {
  require('dotenv').config();
} catch {
  /* dotenv optionnel si npm install pas encore fait */
}
const http = require('http');
const {
  parseReceiptText,
  isPlausibleVendor,
  isColumnHeaderLine,
  isMetaLine,
  isHallucinatedAmount,
  sanitizeOcrPayload,
} = require('./parse-receipt-text');

const PORT = Number(process.env.PORT || 3101);
const PB_URL = (process.env.POCKETBASE_URL || 'http://127.0.0.1:8090').replace(/\/$/, '');
const REQUIRE_AUTH = process.env.REQUIRE_AUTH !== 'false';

const PROVIDER = (process.env.OCR_PROVIDER || 'gemini').toLowerCase();
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || '';
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY || '';
const OCR_SPACE_API_KEY = process.env.OCR_SPACE_API_KEY || 'helloworld';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';

/** Prompt employé — JSON pur uniquement (pas de markdown) */
const GEMINI_RECEIPT_PROMPT = `Tu es un expert-comptable spécialisé dans les reçus du Québec et du Canada.
Analyse ce reçu (photo) et réponds UNIQUEMENT avec un objet JSON valide,
sans markdown, sans \`\`\`json, sans texte avant ou après.
Si une valeur est illisible ou absente, mets null (jamais d'invention).

Lis attentivement CHAQUE ligne, même si l'image est sombre, froissée ou en biais.

RÈGLES IMPORTANTES :
- "fournisseur" = nom du commerce affiché en haut du reçu (pas "Table", "Serveur", "Party Name", ni un numéro de commande).
- "adresse" = adresse du commerce si visible.
- "sous_total_ht" = montant AVANT taxes (sous-total / subtotal / net).
- "tps" = taxe fédérale (GST/TPS, ~5 %). "tvq" = taxe Québec (QST/TVQ, ~9,975 %). "hst" = taxe harmonisée (Ontario, etc.).
  Si tu vois HST seul, mets-le dans "tps" et laisse "tvq" à null.
- "taxes" = total de toutes les taxes (TPS + TVQ + HST).
- "montant" = montant FINAL payé (TTC / Total / Amount Due / Grand Total), JAMAIS le sous-total.
- "date" = date d'émission au format YYYY-MM-DD.
- "numero_facture" = numéro de facture / commande / transaction si présent.
- "mode_paiement" = "comptant", "carte", "interac", "visa", "mastercard", "amex" ou null.
- "articles" = liste des lignes d'achat. Pour chaque article : { "description", "quantite", "prix_unitaire", "prix_total" }.
  Mets jusqu'à 30 articles. Ignore les lignes de sous-total/taxes/total dans les articles.
- "categorie" : choisis la plus probable selon le commerce et les articles.

VÉRIFICATION : sous_total_ht + taxes doit être proche du montant TTC. Si ce n'est pas le cas, relis les chiffres.

Format exact :
{
  "fournisseur": "nom commerce",
  "adresse": "adresse ou null",
  "sous_total_ht": 0.00,
  "tps": 0.00,
  "tvq": 0.00,
  "taxes": 0.00,
  "montant": 0.00,
  "date": "YYYY-MM-DD",
  "numero_facture": "ou null",
  "mode_paiement": "ou null",
  "categorie": "carburant|materiaux|outils|repas|autre",
  "articles": [
    { "description": "article", "quantite": 1, "prix_unitaire": 0.00, "prix_total": 0.00 }
  ],
  "description": "courte description du reçu"
}`;

const SYSTEM_PROMPT = GEMINI_RECEIPT_PROMPT;
const USER_SCAN_TEXT = 'Analyse ce reçu et renvoie le JSON demandé.';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function json(res, code, obj) {
  cors(res);
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

const FETCH_TIMEOUT_MS = Number(process.env.FETCH_TIMEOUT_MS || 90000);
const PB_AUTH_TIMEOUT_MS = Number(process.env.PB_AUTH_TIMEOUT_MS || 8000);

async function fetchWithTimeout(url, options = {}, ms = FETCH_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function pbAuthUser(token) {
  if (!token) return null;
  const auth = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  const refreshUrl = `${PB_URL}/api/collections/users/auth-refresh`;
  const tries = [
    { method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/json' }, body: '{}' },
    { method: 'POST', headers: { Authorization: auth } },
    { method: 'GET', headers: { Authorization: auth } },
  ];
  for (const opts of tries) {
    try {
      const res = await fetchWithTimeout(refreshUrl, opts, PB_AUTH_TIMEOUT_MS);
      if (res.ok) {
        const data = await res.json();
        return data.record || data.model || { id: 'ok' };
      }
    } catch { /* next */ }
  }
  return null;
}

function requestPath(req) {
  const raw = (req.url || '/').split('?')[0];
  return raw.replace(/\/+$/, '') || '/';
}

/** Extrait le texte JSON depuis la réponse REST Gemini */
function extractGeminiResponseText(apiBody) {
  const parts = apiBody?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts) || !parts.length) return '';
  const first = parts[0]?.text;
  if (typeof first === 'string' && first.trim()) return first.trim();
  return parts.map(p => p?.text).filter(Boolean).join('\n').trim();
}

/**
 * Nettoie et parse la réponse Gemini (fences markdown, texte parasite).
 * Retourne null si invalide — ne jamais injecter de texte corrompu dans le formulaire.
 */
function parseGeminiResponse(rawText) {
  const raw = String(rawText || '').trim();
  if (!raw) return null;
  let clean = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  try {
    const obj = JSON.parse(clean);
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : null;
  } catch (e) {
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        const obj = JSON.parse(clean.slice(start, end + 1));
        return obj && typeof obj === 'object' ? obj : null;
      } catch { /* fall through */ }
    }
    console.error('[ocr:gemini] Parsing JSON échoué:', e.message);
    console.error('[ocr:gemini] Réponse brute (500 car.):', raw.slice(0, 500));
    return null;
  }
}

/** @deprecated — utiliser parseGeminiResponse */
function parseAiJson(text) {
  const parsed = parseGeminiResponse(text);
  if (!parsed) throw new Error('JSON invalide');
  return parsed;
}

const CAT_MAP = {
  carburant: 'fuel', materiaux: 'material', materiau: 'material', outils: 'tool', repas: 'food', autre: 'other',
  fuel: 'fuel', material: 'material', tool: 'tool', food: 'food', other: 'other',
};

function num(v) {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(',', '.').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function normalizeExtracted(data, source = 'ai') {
  const catRaw = (data.categorie || data.category || 'other').toString().toLowerCase();
  const tps = num(data.tps);
  const tvq = num(data.tvq);
  let tax_amount = num(data.taxes) ?? num(data.tax_amount);
  if (tax_amount == null && (tps != null || tvq != null)) {
    tax_amount = Math.round(((tps || 0) + (tvq || 0)) * 100) / 100;
  }
  const amount =
    num(data.montant_ttc) ??
    num(data.montant) ??
    num(data.amount) ??
    num(data.total);
  const amount_ht = num(data.sous_total_ht) ?? num(data.amount_ht);
  const strOrNull = (v) => {
    if (v == null || v === '') return null;
    const s = String(v).trim();
    if (!s || s.toLowerCase() === 'null') return null;
    return s;
  };
  const vendorRaw = strOrNull(data.fournisseur || data.vendor || data.merchant);
  const vendor = vendorRaw && isPlausibleVendor(vendorRaw) ? vendorRaw : null;

  let description = strOrNull(data.description);
  if (!description && vendor) {
    const inv = data.numero_facture || data.invoice_number;
    description = inv ? `${vendor} · #${inv}` : vendor;
  }

  const safeDesc = description && isPlausibleVendor(description) ? description : null;
  const line_items = normalizeLineItems(data.articles || data.line_items || data.items);

  return finalizeAmounts({
    vendor,
    amount,
    amount_ht,
    tax_amount,
    tps,
    tvq,
    expense_date: data.date || data.expense_date || null,
    category: CAT_MAP[catRaw] || data.category || 'other',
    description: safeDesc || (vendor ? vendor : null),
    invoice_number: data.numero_facture || data.invoice_number || null,
    payment_method: data.mode_paiement || data.payment_method || null,
    address: data.adresse || data.address || null,
    line_items,
    ocr_raw: data.ocr_raw || data,
    ocr_provider: source,
    ocr_confidence: data.ocr_confidence || (source === 'ocrspace' ? 'medium' : 'high'),
  });
}

/** Nettoie les articles (lignes d'achat) extraits par l'IA */
function normalizeLineItems(items) {
  if (!Array.isArray(items)) return null;
  const out = [];
  for (const it of items) {
    if (!it || typeof it !== 'object') continue;
    const desc = String(it.description || it.nom || it.name || '').trim();
    if (!desc || desc.length > 120) continue;
    if (/^(sous-?total|subtotal|total|tps|tvq|gst|hst|qst|taxe|tax)\b/i.test(desc)) continue;
    const qty = num(it.quantite ?? it.qty ?? it.quantity);
    const unit = num(it.prix_unitaire ?? it.unit_price ?? it.price);
    const total = num(it.prix_total ?? it.total ?? it.amount) ?? (qty != null && unit != null ? Math.round(qty * unit * 100) / 100 : null);
    out.push({
      description: desc,
      quantity: qty,
      unit_price: unit,
      total,
    });
    if (out.length >= 30) break;
  }
  return out.length ? out : null;
}

/** Complète taxes / sous-total si l'IA n'a rempli qu'une partie */
function finalizeAmounts(out) {
  if (!out) return out;
  if (out.amount != null && out.amount_ht != null && out.amount > out.amount_ht + 0.01) {
    const derivedTax = Math.round((out.amount - out.amount_ht) * 100) / 100;
    if (out.tax_amount == null || out.tax_amount === 0) out.tax_amount = derivedTax;
  }
  if (out.amount != null && out.tax_amount != null && out.amount > out.tax_amount + 0.01 && out.amount_ht == null) {
    out.amount_ht = Math.round((out.amount - out.tax_amount) * 100) / 100;
  }
  return out;
}

/** Toujours extraire montants du texte OCR brut — même si l'IA a échoué */
function salvageFromRawText(out, rawText) {
  if (!rawText || rawText.length < 20) return finalizeAmounts(out || {});
  const h = parseReceiptText(rawText);
  const base = out || {};
  return finalizeAmounts({
    ...base,
    vendor: isPlausibleVendor(h.vendor) ? h.vendor : base.vendor,
    amount: h.amount ?? base.amount,
    amount_ht: h.amount_ht ?? base.amount_ht,
    tax_amount: h.tax_amount ?? base.tax_amount,
    expense_date: h.expense_date || base.expense_date,
    category: h.category && h.category !== 'other' ? h.category : base.category,
    description: isPlausibleVendor(h.vendor) ? (h.description || h.vendor) : base.description,
    invoice_number: h.invoice_number || base.invoice_number,
    ocr_raw: base.ocr_raw?.text ? base.ocr_raw : { source: 'ocrspace', text: rawText.slice(0, 4000) },
    ocr_confidence: h.ocr_confidence || base.ocr_confidence || 'low',
  });
}
/** Corrige totaux Gemini avec parser heuristique sur texte_brut */
function refineExtracted(out, aiRaw) {
  const rawText = (aiRaw?.texte_brut || aiRaw?.raw_text || aiRaw?.texte_ocr || '').toString();
  if (rawText.length > 40) {
    const h = parseReceiptText(rawText);
    if (h.amount != null) {
      const looksLikeNetOnly = out.amount != null && h.amount_ht != null
        && Math.abs(out.amount - h.amount_ht) < 0.03;
      const looksLikeTaxOnly = out.amount != null && h.tax_amount != null
        && Math.abs(out.amount - h.tax_amount) < 0.03;
      const taxWrong = h.tax_amount != null && out.tax_amount != null
        && Math.abs(out.tax_amount - h.tax_amount) > 0.08;
      const totalTooLow = out.amount == null || h.amount > out.amount * 1.005 || looksLikeNetOnly || looksLikeTaxOnly || taxWrong;
      if (totalTooLow) {
        out.amount = h.amount;
        if (h.tax_amount != null) out.tax_amount = h.tax_amount;
        if (h.amount_ht != null) out.amount_ht = h.amount_ht;
        if (h.tps != null) out.tps = h.tps;
        if (h.tvq != null) out.tvq = h.tvq;
      } else {
        if (h.tax_amount != null && (out.tax_amount == null || out.tax_amount === 0)) {
          out.tax_amount = h.tax_amount;
        }
        if (h.amount_ht != null && out.amount_ht == null) out.amount_ht = h.amount_ht;
      }
    }
    if (h.expense_date) out.expense_date = h.expense_date;
    if (h.vendor && isPlausibleVendor(h.vendor) && (
      !isPlausibleVendor(out.vendor) || isColumnHeaderLine(out.vendor) || h.vendor.length > (out.vendor || '').length
    )) {
      out.vendor = h.vendor;
      if (!out.description || out.description === out.vendor || isColumnHeaderLine(out.description)) {
        out.description = h.description || h.vendor;
      }
    }
    if (h.category === 'food' && (!out.category || out.category === 'other')) out.category = 'food';
    if (h.invoice_number && !out.invoice_number) out.invoice_number = h.invoice_number;
  }
  return finalizeAmounts(out);
}

function isGarbageScan(out) {
  if (!isPlausibleVendor(out.vendor) || isColumnHeaderLine(out.vendor) || isMetaLine(out.vendor)) return true;
  if (/party\s*name/i.test(out.vendor || '')) return true;
  if (/service\s*charge|servtce/i.test(out.vendor || '')) return true;
  if (isHallucinatedAmount(out.amount)) return true;
  if (isHallucinatedAmount(out.tax_amount)) return true;
  if (out.amount != null && out.tax_amount != null && Math.abs(out.amount - out.tax_amount) < 0.03) return true;
  if (out.amount != null && out.amount_ht != null && out.amount <= out.amount_ht + 0.02) return true;
  if (out.amount != null && out.amount < 10 && (out.category === 'food' || /restaurant|trattoria|saloon|food total/i.test(JSON.stringify(out)))) return true;
  return false;
}

/** Fusionne avec parser OCR.space si Gemini a halluciné */
function applyParsedFallback(out, rawText, sourceTag) {
  const h = parseReceiptText(rawText);
  if (!h.vendor && h.amount == null) return out;
  const merged = {
    ...out,
    vendor: isPlausibleVendor(h.vendor) ? h.vendor : out.vendor,
    amount: h.amount ?? out.amount,
    amount_ht: h.amount_ht ?? out.amount_ht,
    tax_amount: h.tax_amount ?? out.tax_amount,
    expense_date: h.expense_date || out.expense_date,
    category: h.category && h.category !== 'other' ? h.category : out.category,
    description: (isPlausibleVendor(h.vendor) ? (h.description || h.vendor) : out.description),
    invoice_number: h.invoice_number || out.invoice_number,
    ocr_provider: sourceTag,
    ocr_confidence: 'medium',
  };
  if (merged.amount != null && merged.tax_amount != null && Math.abs(merged.amount - merged.tax_amount) < 0.03 && merged.amount_ht != null) {
    merged.amount = Math.round((merged.amount_ht + merged.tax_amount) * 100) / 100;
  }
  return finalizeAmounts(merged);
}

async function fetchOcrSpaceTextLang(imageBase64, language) {
  const form = new FormData();
  form.append('apikey', OCR_SPACE_API_KEY);
  form.append('language', language);
  form.append('isOverlayRequired', 'false');
  form.append('OCREngine', '2');
  form.append('scale', 'true');
  form.append('base64Image', `data:image/jpeg;base64,${stripB64(imageBase64)}`);
  const res = await fetchWithTimeout('https://api.ocr.space/parse/image', { method: 'POST', body: form }, 45000);
  const body = await res.json();
  if (body.IsErroredOnProcessing) return '';
  return (body.ParsedResults || []).map(r => r.ParsedText).join('\n').trim();
}

/** OCR texte le plus long (eng + fre) pour parser montants réels */
async function fetchOcrSpaceText(imageBase64) {
  const eng = await fetchOcrSpaceTextLang(imageBase64, 'eng').catch(() => '');
  const fre = await fetchOcrSpaceTextLang(imageBase64, 'fre').catch(() => '');
  if (fre.length >= eng.length + 20) return fre;
  if (eng.length >= fre.length + 20) return eng;
  return fre.length > eng.length ? fre : eng;
}

/** Scan réussi seulement si magasin + montant TTC lisibles */
function validateReceiptData(data) {
  const missing = [];
  if (!isPlausibleVendor(data.vendor)) missing.push('fournisseur');
  if (data.amount == null || data.amount <= 0) missing.push('montant_ttc');
  return { valid: missing.length === 0, missing };
}

function stripB64(b64) {
  return String(b64).replace(/^data:image\/\w+;base64,/, '');
}

function geminiMimeType(mediaType) {
  const m = (mediaType || 'image/jpeg').toLowerCase();
  if (m === 'image/jpg') return 'image/jpeg';
  if (/^image\/(jpeg|png|webp|gif|heic|heif)$/.test(m)) return m;
  return 'image/jpeg';
}

function buildGeminiRequestBody(imageBase64, mediaType) {
  const mime = geminiMimeType(mediaType);
  return {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{
      parts: [
        {
          inlineData: {
            mimeType: mime,
            data: stripB64(imageBase64),
          },
        },
        { text: GEMINI_RECEIPT_PROMPT },
      ],
    }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
    },
  };
}

/**
 * Appel API Gemini pour scan reçu — image inline + JSON forcé.
 * @returns {{ parsed: object|null, rawText: string, model: string }}
 */
async function callGeminiReceiptScan(model, imageBase64, mediaType) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(GOOGLE_AI_API_KEY)}`;
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildGeminiRequestBody(imageBase64, mediaType)),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini ${res.status}: ${errText.slice(0, 300)}`);
  }
  const body = await res.json();
  const rawText = extractGeminiResponseText(body);
  if (!rawText) {
    const reason = body?.candidates?.[0]?.finishReason || body?.promptFeedback?.blockReason || 'vide';
    throw new Error(`Gemini: réponse vide (${reason})`);
  }
  const parsed = parseGeminiResponse(rawText);
  return { parsed, rawText, model };
}

async function scanGemini(imageBase64, mediaType) {
  if (!GOOGLE_AI_API_KEY) {
    throw new Error('GOOGLE_AI_API_KEY manquante — gratuite sur https://aistudio.google.com/apikey');
  }
  const models = [GEMINI_MODEL, 'gemini-1.5-flash', 'gemini-2.0-flash'].filter((m, i, a) => a.indexOf(m) === i);
  let lastErr;
  for (const model of models) {
    try {
      return await scanGeminiModel(model, imageBase64, mediaType);
    } catch (e) {
      lastErr = e;
      console.warn(`[ocr:gemini:${model}]`, e.message || e);
      if (e.partial) lastErr.partial = e.partial;
    }
  }
  throw lastErr || new Error('Gemini indisponible');
}

async function scanGeminiModel(model, imageBase64, mediaType) {
  const ocrText = await fetchOcrSpaceText(imageBase64).catch(() => '');
  const parsedFromOcr = ocrText.length > 40 ? parseReceiptText(ocrText) : null;

  const { parsed: geminiJson, rawText } = await callGeminiReceiptScan(model, imageBase64, mediaType);
  const rawForParse = ocrText.length > 40 ? ocrText : '';

  let out = null;
  if (geminiJson) {
    out = normalizeExtracted(geminiJson, 'gemini');
    out = refineExtracted(out, { texte_brut: rawForParse });
  } else {
    console.warn('[ocr:gemini] JSON illisible — repli OCR texte uniquement');
  }

  if (!out && parsedFromOcr) {
    out = finalizeAmounts({ ...parsedFromOcr, ocr_provider: 'ocrspace' });
  }

  if (out && parsedFromOcr && (isGarbageScan(out) || !validateReceiptData(out).valid)) {
    out = finalizeAmounts({
      vendor: isPlausibleVendor(parsedFromOcr.vendor) ? parsedFromOcr.vendor : out.vendor,
      amount: parsedFromOcr.amount ?? out.amount,
      amount_ht: parsedFromOcr.amount_ht ?? out.amount_ht,
      tax_amount: parsedFromOcr.tax_amount ?? out.tax_amount,
      expense_date: parsedFromOcr.expense_date || out.expense_date,
      category: parsedFromOcr.category && parsedFromOcr.category !== 'other' ? parsedFromOcr.category : out.category,
      description: parsedFromOcr.description || out.description,
      invoice_number: parsedFromOcr.invoice_number || out.invoice_number,
      ocr_raw: parsedFromOcr.ocr_raw || { text: rawForParse.slice(0, 4000) },
      ocr_provider: 'gemini+ocrspace',
      ocr_confidence: parsedFromOcr.amount && parsedFromOcr.vendor ? 'medium' : out.ocr_confidence,
    });
  } else if (out && isGarbageScan(out) && rawForParse.length > 40) {
    out = applyParsedFallback(out, rawForParse, 'gemini+ocrspace');
  }
  let check = out ? validateReceiptData(out) : { valid: false, missing: ['fournisseur', 'montant_ttc'] };
  if (!check.valid && rawForParse.length > 40 && out) {
    out = applyParsedFallback(out, rawForParse, 'ocrspace');
    check = validateReceiptData(out);
  }
  if (!check.valid && parsedFromOcr) {
    out = finalizeAmounts({ ...parsedFromOcr, ocr_provider: 'ocrspace' });
    check = validateReceiptData(out);
  }
  out = out ? sanitizeOcrPayload(out) : null;
  if (!check.valid) {
    const err = new Error(
      geminiJson
        ? `Données incomplètes (${check.missing.join(', ')})`
        : 'Lecture automatique échouée — remplissez manuellement'
    );
    err.code = geminiJson ? 'incomplete' : 'parse_failed';
    err.partial = sanitizeOcrPayload(out || {});
    throw err;
  }
  return out;
}

async function scanClaude(imageBase64, mediaType) {
  if (!CLAUDE_API_KEY) throw new Error('CLAUDE_API_KEY manquante');
  const res = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType || 'image/jpeg',
              data: stripB64(imageBase64),
            },
          },
          { type: 'text', text: USER_SCAN_TEXT },
        ],
      }],
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Claude ${res.status}: ${errText.slice(0, 300)}`);
  }
  const body = await res.json();
  const text = (body.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n');
  const parsed = parseAiJson(text);
  let out = normalizeExtracted(parsed, 'claude');
  out = refineExtracted(out, parsed);
  const check = validateReceiptData(out);
  if (!check.valid) {
    const err = new Error(`Données incomplètes (${check.missing.join(', ')})`);
    err.partial = out;
    throw err;
  }
  return out;
}

async function scanOcrSpace(imageBase64) {
  const form = new FormData();
  form.append('apikey', OCR_SPACE_API_KEY);
  form.append('language', 'fre');
  form.append('isOverlayRequired', 'false');
  form.append('base64Image', `data:image/jpeg;base64,${stripB64(imageBase64)}`);

  const res = await fetchWithTimeout('https://api.ocr.space/parse/image', { method: 'POST', body: form }, 45000);
  const body = await res.json();
  if (body.IsErroredOnProcessing) {
    throw new Error(body.ErrorMessage?.[0] || 'OCR.space erreur');
  }
  const text = (body.ParsedResults || []).map(r => r.ParsedText).join('\n');
  if (!text.trim()) throw new Error('Aucun texte lu sur le reçu');
  let out = salvageFromRawText(parseReceiptText(text), text);
  const check = validateReceiptData(out);
  if (!check.valid) {
    const err = new Error(`Données incomplètes (${check.missing.join(', ')})`);
    err.partial = out;
    throw err;
  }
  return out;
}

async function scanReceipt(imageBase64, mediaType) {
  const chain = process.env.OCR_FALLBACK
    ? process.env.OCR_FALLBACK.split(',').map(s => s.trim().toLowerCase())
    : [PROVIDER, 'gemini', 'ocrspace'].filter((v, i, a) => a.indexOf(v) === i);

  let lastErr;
  for (const p of chain) {
    try {
      if (p === 'gemini' && GOOGLE_AI_API_KEY) return await scanGemini(imageBase64, mediaType);
      if (p === 'claude' && CLAUDE_API_KEY) return await scanClaude(imageBase64, mediaType);
      if (p === 'ocrspace') return await scanOcrSpace(imageBase64);
      if (p === 'gemini' && !GOOGLE_AI_API_KEY) continue;
      if (p === 'claude' && !CLAUDE_API_KEY) continue;
    } catch (e) {
      lastErr = e;
      console.warn(`[ocr:${p}]`, e.message || e);
      if (e.partial) lastErr.partial = e.partial;
    }
  }
  throw lastErr || new Error(
    'Aucun OCR configuré. Ajoutez GOOGLE_AI_API_KEY (gratuit) dans .env — voir services/receipt-ocr/README.md'
  );
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    cors(res);
    res.writeHead(204);
    return res.end();
  }
  const path = requestPath(req);
  if (req.method === 'GET' && (path === '/health' || path === '/ocr/health')) {
    return json(res, 200, {
      ok: true,
      provider: PROVIDER,
      model: PROVIDER === 'claude' ? CLAUDE_MODEL : PROVIDER === 'gemini' ? GEMINI_MODEL : 'ocrspace',
      gemini: !!GOOGLE_AI_API_KEY,
      claude: !!CLAUDE_API_KEY,
      ocrspace: !!OCR_SPACE_API_KEY,
      auth: REQUIRE_AUTH,
      pocketbase: PB_URL,
    });
  }
  const isScan =
    req.method === 'POST' &&
    (path === '/scan-receipt' || path === '/ocr/scan-receipt' || path.endsWith('/scan-receipt'));
  if (!isScan) {
    return json(res, 404, { error: 'Not found', path });
  }

  try {
    const auth = req.headers.authorization || '';
    if (REQUIRE_AUTH) {
      const user = await pbAuthUser(auth);
      if (!user) {
        console.warn('[ocr] auth refusée — POCKETBASE_URL=', PB_URL);
        return json(res, 401, { ok: false, error: 'Non autorisé — reconnectez-vous dans l’app employé', code: 'auth' });
      }
    }

    const body = await readBody(req);
    const b64 = body.imageBase64 || body.image;
    if (!b64) return json(res, 400, { ok: false, error: 'imageBase64 requis' });

    const data = sanitizeOcrPayload(await scanReceipt(b64, body.mimeType || 'image/jpeg'));
    return json(res, 200, { ok: true, data, provider: PROVIDER });
  } catch (e) {
    console.warn('[ocr]', e.message || e);
    const partial = e.partial || null;
    const rawText = partial?.ocr_raw?.text || '';
    const salvaged = rawText ? salvageFromRawText(partial, rawText) : partial;
    if (salvaged && (salvaged.vendor || salvaged.amount)) {
      const clean = sanitizeOcrPayload(salvaged);
      return json(res, 200, {
        ok: true,
        partial: !validateReceiptData(clean).valid,
        data: clean,
        missing: validateReceiptData(salvaged).missing,
        error: e.message || 'Partiel',
      });
    }
    const cleanPartial = partial ? sanitizeOcrPayload(partial) : partial;
    return json(res, 200, {
      ok: false,
      partial: cleanPartial,
      data: cleanPartial,
      missing: cleanPartial ? validateReceiptData(cleanPartial).missing : undefined,
      error: e.message || 'Échec OCR',
      code: e.code || undefined,
    });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  const keyHint = GOOGLE_AI_API_KEY
    ? `${GOOGLE_AI_API_KEY.slice(0, 6)}… (${GOOGLE_AI_API_KEY.length} car.)`
    : 'MANQUANTE';
  console.log(`[receipt-ocr] http://0.0.0.0:${PORT} (LAN: http://<ip-pc>:${PORT}/scan-receipt) provider=${PROVIDER} auth=${REQUIRE_AUTH} gemini=${keyHint}`);
  if (GOOGLE_AI_API_KEY && !/^(AIza|AQ\.)/.test(GOOGLE_AI_API_KEY)) {
    console.warn('[receipt-ocr] Clé Gemini inhabituelle — créez-en une sur https://aistudio.google.com/apikey (AIza… ou AQ.…)');
  }
});
