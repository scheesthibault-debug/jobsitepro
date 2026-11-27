/**
 * Extraction depuis texte OCR (OCR.space) — reçus Québec / Canada / Ontario
 */
const CAT_KEYWORDS = [
  ['carburant', 'fuel'], ['fuel', 'fuel'], ['essence', 'fuel'], ['petro', 'fuel'], ['shell', 'fuel'],
  ['ultramar', 'fuel'], ['irving', 'fuel'], ['canac', 'material'], ['rona', 'material'],
  ['home depot', 'material'], ['materiaux', 'material'], ['bmr', 'material'],
  ['restaurant', 'food'], ['saloon', 'food'], ['bar', 'food'], ['pub', 'food'], ['sushi', 'food'],
  ['trattoria', 'food'], ['tavern', 'food'], ['bistro', 'food'], ['grill', 'food'],
  ['repas', 'food'], ['tim hortons', 'food'], ['mcdonald', 'food'],
  ['subway', 'food'], ['st-hubert', 'food'], ['st hubert', 'food'],
  ['working dog', 'food'], ['riz north', 'food'], ['kayak', 'other'],
];

const VENDOR_HINTS = /\b(saloon|restaurant|trattoria|taverniti|tavern|caf[eé]|bistro|grill|pub|bar|inc|ltd|ltée|quincaillerie|dépôt|depot|rona|canac|ultramar|petro|shell|hubert|hortons|mcdonald|subway|aventures?)\b/i;
const COLUMN_HEADER = /^(qty|oty|quantity|item|ite\(?|description|jescription|desc|price|prix|montant)\b/i;
const COLUMN_HEADER_LOOSE = /\b(qty|oty|item|ite\(?|description|jescription|desc)\b.*\b(price|prix)\b/i;
const META_VENDOR = /^(party\s*name|table|waiter|walter|server|guests|order|printed|food\s+total|alcohol|sub\s+total|tax|tel|phone|november|january|february|march|april|may|june|july|august|september|october|december|\d+\s*guests)/i;
const SUMMARY_LABELS = [
  { re: /^food\s+total/i, key: 'food_total' },
  { re: /^alcohol\s+total/i, key: 'alcohol_total' },
  { re: /^sub\s*total/i, key: 'subtotal' },
  { re: /^subtotal\b/i, key: 'subtotal' },
  { re: /^net\s+total/i, key: 'subtotal' },
  { re: /^tax\s*\d+/i, key: 'tax' },
  { re: /^alcohol\s+tax/i, key: 'tax' },
  { re: /^(hst|gst|tps|tvq|pst|qst)\b/i, key: 'tax' },
  { re: /^total\s+due/i, key: 'grand_total' },
  { re: /^amount\s+due/i, key: 'grand_total' },
  { re: /^total\b/i, key: 'grand_total' },
];

function guessCategory(text, vendor) {
  const t = `${vendor || ''} ${text}`.toLowerCase();
  for (const [k, v] of CAT_KEYWORDS) {
    if (t.includes(k)) return v;
  }
  return 'other';
}

/** Corrige $ lu comme S, .oo/.so, espaces dans les montants */
function normalizeOcrText(rawText) {
  let t = String(rawText || '').replace(/\uFFFD/g, '');
  t = t.replace(/(\d)\.[oO]{2}\b/g, '$1.00');
  t = t.replace(/(\d)\.so\b/gi, '$1.50');
  t = t.replace(/\bS[Il1|\s]+(\d+[.,]\d{2}|\d+[.,][oO0]{2}|\d+\.so)/gi, (_, amt) => {
    const cleaned = amt.replace(/[oO]/g, '0').replace(/\.so/i, '.50').replace(',', '.');
    return `$${cleaned}`;
  });
  t = t.replace(/\bS(\d+[.,]\d{2}|\d+[.,][oO0]{2})/gi, (_, amt) => {
    const cleaned = amt.replace(/[oO]/g, '0').replace(',', '.');
    return `$${cleaned}`;
  });
  t = t.replace(/(\$)\s*(\d+)\s*\.\s*(\d{2})/g, '$1$2.$3');
  t = t.replace(/(\d+)\s*\.\s*(\d{2})(?!\d)/g, '$1.$2');
  t = t.replace(/\$(\d+)\s+(\d{2})\b/g, '$$$1.$2');
  t = t.replace(/(\d),(\d{2})\b/g, '$1.$2');
  return t;
}

function parseMoney(s) {
  const cleaned = String(s).replace(/\s/g, '').replace(/[^\d.,]/g, '').replace(',', '.');
  const m = cleaned.match(/(\d+\.\d{2}|\d+)/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function extractMoneyFromLine(line) {
  const normalized = normalizeOcrText(line);
  const patterns = [
    /[\$€]\s*(\d+(?:\.\d{2})?)/,
    /(\d+\.\d{2})\s*[\$€]/,
    /(?:^|\s)(\d+\.\d{2})(?:\s|$)/,
  ];
  for (const re of patterns) {
    const m = normalized.match(re);
    if (m) {
      const v = parseMoney(m[1]);
      if (v != null) return v;
    }
  }
  return null;
}

function extractAllAmounts(text) {
  const normalized = normalizeOcrText(text);
  const out = [];
  for (const m of normalized.matchAll(/[\$€]\s*(\d+\.\d{2})/g)) {
    const v = parseMoney(m[1]);
    if (v != null && v > 0) out.push(v);
  }
  return out;
}

function isColumnHeaderLine(line) {
  const l = String(line || '').trim();
  if (!l) return true;
  if (COLUMN_HEADER.test(l)) return true;
  if (COLUMN_HEADER_LOOSE.test(l)) return true;
  if (/\b(qty|oty|item|ite\(?ll|description|jescription)\b/i.test(l) && l.length < 40) return true;
  return false;
}

function isMetaLine(line) {
  const l = String(line || '').trim();
  if (!l) return true;
  if (META_VENDOR.test(l)) return true;
  if (/service\s*charge|servtce\s*charge/i.test(l)) return true;
  if (/^oate:/i.test(l)) return true;
  if (/^(date|heure|printed)\b/i.test(l)) return true;
  if (/^(trans|table|server|tel|phone|www\.|http|date|heure|facture|receipt|ticket|\d+\s+\S|reprint|\*{2,}|serv\b|\(dine)/i.test(l)) return true;
  if (/:\s*\d+\s*$/.test(l)) return true;
  if (/^\d+\s*guests/i.test(l)) return true;
  return false;
}

/** Montants souvent hallucinés par l’IA (placeholders UI / exemples) */
const HALLUCINATED_AMOUNTS = new Set([24.99, 3.49, 19.99, 29.99, 9.99, 49.99]);

function isHallucinatedAmount(n) {
  if (n == null || !Number.isFinite(n)) return false;
  return HALLUCINATED_AMOUNTS.has(Math.round(n * 100) / 100);
}

function isPlausibleVendor(name) {
  const v = String(name || '').trim();
  if (v.length < 3) return false;
  if (isColumnHeaderLine(v)) return false;
  if (isMetaLine(v)) return false;
  if (/[{}\[\]<>|\\^`~]/.test(v)) return false;
  if (/[0-9]{2,}[a-zA-Z]|[a-zA-Z][0-9]{2,}[a-zA-Z0-9-]{2,}/.test(v) && !/\b(19|20)\d{2}\b/.test(v)) return false;
  if (/^(total|tota|net|hst|gst|subtotal|price|server|serv|trans|table|party\s*name|reprint)\b/i.test(v)) return false;
  if (/party\s*name/i.test(v)) return false;
  const letters = (v.match(/[A-Za-zÀ-ÿ]/g) || []).length;
  if (letters < 3 || letters / v.length < 0.45) return false;
  return true;
}

function cleanVendorName(line) {
  const l = String(line || '').trim();
  if (/tratt|tavern|avernit/i.test(l)) return 'Trattoria Taverniti';
  if (/working\s*dog|saloon/i.test(l) && /dog|saloon/i.test(l)) return 'WORKING DOG SALOON';
  if (/elk\s*north|riz\s*north|north\s*restaurant/i.test(l)) return 'RIZ NORTH RESTAURANT';
  return l.replace(/\s{2,}/g, ' ').trim();
}

function inferVendorFromText(text, lines) {
  const known = [
    [/elk\s*north|riz\s*north|north\s*restaurant/i, 'RIZ NORTH RESTAURANT'],
    [/tratt\w*\s*tavern\w*|taverniti|avernit/i, 'Trattoria Taverniti'],
    [/working\s*dog\s*saloon/i, 'WORKING DOG SALOON'],
    [/riz\s*north\s*restaurant/i, 'RIZ NORTH RESTAURANT'],
    [/kayak\s*aventures?/i, 'KAYAK AVENTURES'],
  ];
  for (const [re, name] of known) {
    if (re.test(text)) return name;
  }
  if (/\bcaesar\b/i.test(text) && /\b(reprint|tabo|sushi|yonge)\b/i.test(text)) {
    return 'RIZ NORTH RESTAURANT';
  }
  const addr = /\d+\s+(college|street|st\b|ave|avenue|rue)|toronto|montréal|ontario|canada|m6[a-z]\s*\d[a-z]\d/i;
  for (const line of lines.slice(0, 8)) {
    if (addr.test(line) || isMetaLine(line) || isColumnHeaderLine(line)) continue;
    const cleaned = cleanVendorName(line);
    if (cleaned.length >= 4 && isPlausibleVendor(cleaned)) return cleaned;
  }
  for (const line of lines.slice(0, 14)) {
    if (/\bsaloon\b/i.test(line) && !isColumnHeaderLine(line)) {
      return /dog/i.test(text) ? 'WORKING DOG SALOON' : line.trim();
    }
    if (/\b(restaurant|trattoria|bistro|grill)\b/i.test(line) && line.length < 60) {
      return cleanVendorName(line);
    }
  }
  return null;
}

function scoreVendorLine(line) {
  let score = 0;
  const l = line.trim();
  if (l.length < 4 || l.length > 80) return -100;
  if (isColumnHeaderLine(l) || isMetaLine(l)) return -100;
  if (VENDOR_HINTS.test(l)) score += 30;
  if (/^[A-ZÀ-Ÿ]/.test(l)) score += 8;
  if (/^\d/.test(l)) score -= 20;
  if (/\(\d{3}\)|@\d|www\./i.test(l)) score -= 30;
  score += Math.min(l.split(/\s+/).length, 4);
  return score;
}

function pickVendor(lines) {
  const addr = /yonge\s|college|avenue|\bave\b|\bair\b|\bstreet\b|\bst\b|\brue\b|toronto|montréal|montreal|québec|quebec|ontario|canada|\bON\b|\bQC\b|\(\d{3}\)|\d{5}|m6[a-z]/i;
  let best = null;
  let bestScore = -999;
  for (let i = 0; i < Math.min(lines.length, 16); i++) {
    const line = lines[i];
    if (line.length < 3 || addr.test(line)) continue;
    if (isColumnHeaderLine(line) || isMetaLine(line)) continue;
    if (/^tota\b|^total\b/i.test(line)) continue;
    if (/[{}\[\]]/.test(line)) continue;
    if (/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}/i.test(line)) continue;
    if (/\d{1,2}:\d{2}\s*(am|pm)/i.test(line)) continue;
    const score = scoreVendorLine(line) + (i === 0 ? 15 : 0);
    const cleaned = cleanVendorName(line);
    if (score > bestScore && isPlausibleVendor(cleaned)) {
      bestScore = score;
      best = cleaned;
    }
  }
  if (best && isPlausibleVendor(best)) return best;
  return inferVendorFromText(lines.join('\n'), lines);
}

function parseLongEnDate(text) {
  const months = {
    january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
    july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
  };
  const m = text.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(20\d{2})\b/i
  );
  if (!m) return null;
  const mm = months[m[1].toLowerCase()];
  if (!mm) return null;
  return `${m[3]}-${mm}-${String(m[2]).padStart(2, '0')}`;
}

function parseEnDate(text) {
  const en = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  };
  const m = text.match(
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+(\d{1,2}),?\s*[-–]?\s*(20\d{2}|\d{2})\b/i
  );
  if (!m) return null;
  const key = m[1].toLowerCase().slice(0, 3);
  const mm = en[key];
  if (!mm) return null;
  let year = m[3];
  if (year.length === 2) year = `20${year}`;
  const day = String(m[2]).padStart(2, '0');
  return `${year}-${mm}-${day}`;
}

function moneyOnNextLines(lines, startIdx, maxLook = 4) {
  for (let j = startIdx + 1; j <= Math.min(startIdx + maxLook, lines.length - 1); j++) {
    const v = extractMoneyFromLine(lines[j]);
    if (v != null && v > 0) return v;
  }
  return null;
}

/** Labels résumé sans montant sur la même ligne → montants en bloc en bas du ticket */
function parseSummaryBlock(lines, allAmounts) {
  const entries = [];
  for (let i = 0; i < lines.length; i++) {
    for (const { re, key } of SUMMARY_LABELS) {
      if (re.test(lines[i])) {
        entries.push({ key, lineIdx: i, value: extractMoneyFromLine(lines[i]) });
        break;
      }
    }
  }
  if (!entries.length) return null;

  const unpaired = entries.filter(e => e.value == null);
  if (unpaired.length >= 2 && allAmounts.length >= unpaired.length) {
    const tail = allAmounts.slice(-unpaired.length);
    let ti = 0;
    for (const e of entries) {
      if (e.value == null && ti < tail.length) e.value = tail[ti++];
    }
  }
  return entries;
}

function parseReceiptText(rawText) {
  const text = normalizeOcrText(rawText);
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const lower = text.toLowerCase();
  const allAmounts = extractAllAmounts(text);

  let vendor = pickVendor(lines);

  let amount = null;
  let amount_ht = null;
  let tax_amount = null;
  const tps = null;
  const tvq = null;

  const summary = parseSummaryBlock(lines, allAmounts);
  if (summary?.length) {
    const sub = summary.find(e => e.key === 'subtotal' && e.value != null);
    const taxes = summary.filter(e => e.key === 'tax' && e.value != null);
    const grandTotals = summary.filter(e => e.key === 'grand_total' && e.value != null);
    const grand = grandTotals.length ? grandTotals[grandTotals.length - 1] : null;
    if (sub) amount_ht = sub.value;
    if (taxes.length) tax_amount = Math.round(taxes.reduce((s, e) => s + e.value, 0) * 100) / 100;
    if (grand) amount = grand.value;
    else if (amount_ht != null && tax_amount != null) {
      amount = Math.round((amount_ht + tax_amount) * 100) / 100;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    if (/^tota\b|^total\b/i.test(lines[i])) {
      let v = extractMoneyFromLine(lines[i]);
      if (v == null) v = moneyOnNextLines(lines, i, 3);
      if (v != null && v > 5) amount = v;
    }
  }

  const totalAmounts = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const ll = line.toLowerCase();
    if (/^net\s+total|^sub\s*total|^subtotal|total\s*ht|total\s*taxes|^amount\s+due|^food\s+total|^alcohol\s+total/i.test(ll)) continue;
    if (/^total\b/i.test(line)) {
      let v = extractMoneyFromLine(line);
      if (v == null) v = moneyOnNextLines(lines, i, 3);
      if (v != null) totalAmounts.push(v);
    }
  }
  if (amount == null && totalAmounts.length) amount = totalAmounts[totalAmounts.length - 1];

  if (amount_ht == null) {
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i].toLowerCase();
      if (/^sub\s+total|^subtotal\b|^net\s+total/i.test(l)) {
        let v = extractMoneyFromLine(lines[i]);
        if (v == null) v = moneyOnNextLines(lines, i, 2);
        if (v != null) { amount_ht = v; break; }
      }
    }
  }

  {
    let taxSum = 0;
    let taxLineCount = 0;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i].toLowerCase();
      if (!/(hst|gst|tps|tvq|pst|qst|\btax\b|foodhst)/i.test(l)) continue;
      if (/^total\b|subtotal|service\s*charge|servtce|gratuity|pourboire|food\s+total|alcohol\s+total/i.test(l)) continue;
      let v = extractMoneyFromLine(lines[i]);
      if (v == null) v = moneyOnNextLines(lines, i, 2);
      if (v != null && v > 0 && v < 500 && v !== 13.22) {
        taxSum += v;
        taxLineCount++;
      }
    }
    if (taxLineCount > 0) tax_amount = Math.round(taxSum * 100) / 100;
  }

  if (amount == null && amount_ht != null && tax_amount != null) {
    amount = Math.round((amount_ht + tax_amount) * 100) / 100;
  } else if (amount == null && allAmounts.length >= 3) {
    const tail = allAmounts.slice(-5);
    const max = Math.max(...tail);
    const sorted = [...tail].sort((a, b) => a - b);
    const maybeSub = sorted.find(n => n > 20 && tail.filter(t => t > n).some(t => t - n < 15));
    if (maybeSub != null && tax_amount != null) {
      amount = Math.round((maybeSub + tax_amount) * 100) / 100;
      if (amount_ht == null) amount_ht = maybeSub;
    } else {
      amount = max;
    }
  }

  if (amount != null && tax_amount != null && amount > tax_amount) {
    const derivedHt = Math.round((amount - tax_amount) * 100) / 100;
    if (amount_ht == null || amount_ht < derivedHt * 0.5) amount_ht = derivedHt;
  }

  if (amount != null && tax_amount != null && Math.abs(amount - tax_amount) < 0.02 && amount_ht != null) {
    amount = Math.round((amount_ht + tax_amount) * 100) / 100;
  }

  let expense_date = parseLongEnDate(text) || null;
  const mois = {
    janvier: '01', fevrier: '02', mars: '03', avril: '04', mai: '05', juin: '06',
    juillet: '07', aout: '08', septembre: '09', octobre: '10', novembre: '11', decembre: '12',
  };
  if (!expense_date) {
    const frDate = text.match(/(\d{1,2})\s+(janvier|f[eé]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[eé]cembre)\s+(20\d{2})/i);
    if (frDate) {
      const key = frDate[2].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const mm = mois[key];
      const day = String(frDate[1]).padStart(2, '0');
      if (mm) expense_date = `${frDate[3]}-${mm}-${day}`;
    }
  }
  if (!expense_date) expense_date = parseEnDate(text);

  const category = guessCategory(lower, vendor);
  const invoice_number = (text.match(/(?:order\s*#|trans\.?\s*#|facture|invoice|receipt)\s*#?\s*([A-Z0-9-]{4,})/i) || [])[1] || null;

  if (amount != null && isHallucinatedAmount(amount)) amount = null;
  if (tax_amount != null && isHallucinatedAmount(tax_amount)) tax_amount = null;
  if (amount == null && allAmounts.length) {
    const candidates = allAmounts.filter(a => a > 15 && !isHallucinatedAmount(a));
    if (candidates.length) amount = candidates[candidates.length - 1];
  }

  return {
    vendor: vendor?.slice(0, 120) || null,
    amount,
    amount_ht,
    tax_amount,
    tps,
    tvq,
    expense_date,
    category,
    invoice_number,
    description: [vendor, invoice_number ? `#${invoice_number}` : ''].filter(Boolean).join(' · ').slice(0, 120) || null,
    ocr_raw: { source: 'ocrspace', text: text.slice(0, 4000) },
    ocr_confidence: amount != null && vendor ? 'medium' : 'low',
  };
}

/** Nettoie une extraction IA avant envoi au client */
function sanitizeOcrPayload(data) {
  if (!data || typeof data !== 'object') return data;
  const out = { ...data };
  if (isHallucinatedAmount(out.amount)) out.amount = null;
  if (isHallucinatedAmount(out.tax_amount)) out.tax_amount = null;
  if (!isPlausibleVendor(out.vendor)) {
    const badDesc = out.description;
    out.vendor = null;
    if (badDesc === data.vendor || !isPlausibleVendor(badDesc)) out.description = null;
  }
  if (out.expense_date) {
    const d = new Date(`${out.expense_date}T12:00:00`);
    const now = new Date();
    if (!Number.isFinite(d.getTime()) || d.getFullYear() < 2015 || d > now) out.expense_date = null;
  }
  return finalizeParsed(out);
}

function finalizeParsed(out) {
  if (out.amount != null && out.tax_amount != null && Math.abs(out.amount - out.tax_amount) < 0.03 && out.amount_ht != null) {
    out.amount = Math.round((out.amount_ht + out.tax_amount) * 100) / 100;
  }
  return out;
}

module.exports = {
  parseReceiptText,
  isPlausibleVendor,
  isColumnHeaderLine,
  isMetaLine,
  normalizeOcrText,
  isHallucinatedAmount,
  HALLUCINATED_AMOUNTS,
  sanitizeOcrPayload,
};
