#!/bin/bash
# Corrige parse-receipt-text.js (bug st-hubert) et redémarre OCR
# Usage: sudo bash /chemin/vers/fix-on-server.sh
# Exemple depuis clé USB:
#   sudo bash /mnt/stockage/chantiertrack-v2/chantiertrack-v2/services/receipt-ocr/fix-on-server.sh

set -e
TARGET="/opt/chantiertrack/receipt-ocr/parse-receipt-text.js"
[ "$(id -u)" -eq 0 ] || { echo "sudo requis"; exit 1; }

echo "[1] Écriture parse-receipt-text.js corrigé..."
cat > "$TARGET" << 'ENDOFFILE'
/**
 * Extraction depuis texte OCR (OCR.space) — reçus Québec / Canada
 */
const CAT_KEYWORDS = [
  ['carburant', 'fuel'], ['fuel', 'fuel'], ['essence', 'fuel'], ['petro', 'fuel'], ['shell', 'fuel'],
  ['ultramar', 'fuel'], ['irving', 'fuel'], ['canac', 'material'], ['rona', 'material'],
  ['home depot', 'material'], ['materiaux', 'material'], ['bmr', 'material'],
  ['repas', 'food'], ['restaurant', 'food'], ['tim hortons', 'food'], ['mcdonald', 'food'],
  ['subway', 'food'], ['st-hubert', 'food'], ['st hubert', 'food'],
  ['outils', 'tool'], ['tool', 'tool'], ['canadian tire', 'tool'],
];

function guessCategory(text, vendor) {
  const t = `${vendor || ''} ${text}`.toLowerCase();
  for (const [k, v] of CAT_KEYWORDS) {
    if (t.includes(k)) return v;
  }
  return 'other';
}

function parseMoney(s) {
  const m = String(s).replace(/\s/g, '').replace(',', '.').match(/(\d+\.\d{2}|\d+)/);
  return m ? parseFloat(m[1]) : null;
}

function parseReceiptText(rawText) {
  const lines = String(rawText || '')
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  const text = lines.join('\n');
  const lower = text.toLowerCase();

  let vendor = null;
  for (const line of lines.slice(0, 8)) {
    if (line.length < 3) continue;
    if (/^(date|heure|facture|receipt|ticket|tel|phone|www\.|http)/i.test(line)) continue;
    if (/^\d+[\s,.\d$]+$/.test(line)) continue;
    vendor = line;
    break;
  }
  if (!vendor && lines[0]) vendor = lines[0];

  let amount = null;
  let amount_ht = null;
  let tax_amount = null;
  let tps = null;
  let tvq = null;

  const totalRes = [
    /(?:total\s*(?:à\s*payer|du|facturé|ttc)?|montant\s*du|balance\s*due|amount\s*due)\s*[:\s]*\$?\s*(\d+[.,]\d{2})/i,
    /(?:^|\s)total\s*[:\s]*\$?\s*(\d+[.,]\d{2})/i,
    /(?:visa|mastercard|debit|argent)\s+\$?\s*(\d+[.,]\d{2})/i,
  ];
  for (const line of [...lines].reverse()) {
    for (const re of totalRes) {
      const m = line.match(re);
      if (m) {
        amount = parseMoney(m[1]);
        break;
      }
    }
    if (amount != null) break;
  }
  if (amount == null) {
    const all = [...text.matchAll(/\$\s*(\d+[.,]\d{2})/g)].map(x => parseMoney(x[1])).filter(n => n > 0);
    if (all.length) amount = all[all.length - 1];
  }

  for (const line of lines) {
    const l = line.toLowerCase();
    if (/\btps\b|\bgst\b|\bhst\b/.test(l) && !/\btvq\b/.test(l)) {
      const m = line.match(/(\d+[.,]\d{2})/);
      if (m) tps = parseMoney(m[1]);
    }
    if (/\btvq\b|\bqst\b|\bpst\b/.test(l)) {
      const m = line.match(/(\d+[.,]\d{2})/);
      if (m) tvq = parseMoney(m[1]);
    }
    if (/sous[- ]?total|subtotal|montant\s*ht/i.test(l) && amount_ht == null) {
      const m = line.match(/(\d+[.,]\d{2})/);
      if (m) amount_ht = parseMoney(m[1]);
    }
  }

  if (tps != null || tvq != null) tax_amount = (tps || 0) + (tvq || 0);
  else {
    const taxLine = lines.find(l => /tps|tvq|gst|hst|taxes/i.test(l));
    if (taxLine) {
      const nums = [...taxLine.matchAll(/(\d+[.,]\d{2})/g)].map(x => parseMoney(x[1]));
      tax_amount = nums.reduce((a, b) => a + (b || 0), 0) || null;
    }
  }

  if (amount_ht == null && amount != null && tax_amount != null) {
    amount_ht = Math.round((amount - tax_amount) * 100) / 100;
  }

  let expense_date = null;
  const iso = text.match(/(20\d{2})[-/](\d{2})[-/](\d{2})/);
  const dmy = text.match(/(\d{2})[-/](\d{2})[-/](20\d{2})/);
  if (iso) expense_date = `${iso[1]}-${iso[2]}-${iso[3]}`;
  else if (dmy) expense_date = `${dmy[3]}-${dmy[2]}-${dmy[1]}`;

  const category = guessCategory(lower, vendor);
  const invoice_number = (text.match(/(?:facture|invoice|receipt|trans\.?)\s*#?\s*([A-Z0-9-]{4,})/i) || [])[1] || null;

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

module.exports = { parseReceiptText };
ENDOFFILE

chown chantiertrack:chantiertrack "$TARGET" 2>/dev/null || true

echo "[2] Vérification syntaxe..."
node --check "$TARGET"
node --check /opt/chantiertrack/receipt-ocr/server.js

echo "[3] Redémarrage..."
systemctl restart chantiertrack-ocr
sleep 3
systemctl is-active chantiertrack-ocr && echo "Service: OK" || { journalctl -u chantiertrack-ocr -n 10 --no-pager; exit 1; }

echo "[4] Tests..."
curl -sf http://127.0.0.1:3101/health && echo ""
curl -sf http://127.0.0.1:8888/ocr/health && echo "" || echo "8888: vérifier Nginx /ocr/"
echo "[✓] Terminé"
