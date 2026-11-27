#!/bin/bash
# Répare le service OCR quand Nginx renvoie 502 Bad Gateway
# Usage: sudo bash deployment/fix-ocr-502.sh

set -e
APP_DIR="${APP_DIR:-/opt/chantiertrack/receipt-ocr}"
USB="${USB_ROOT:-/mnt/stockage/chantiertrack-v2/chantiertrack-v2}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn(){ echo -e "${YELLOW}[!]${NC} $1"; }
err() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

[ "$(id -u)" -eq 0 ] || err "Lancez avec sudo"

echo "=== JobsitePro — Réparation OCR (502) ==="

# Copier depuis clé USB si présente
if [ -f "$USB/services/receipt-ocr/server.js" ]; then
  ok "Copie depuis clé USB: $USB/services/receipt-ocr/"
  mkdir -p "$APP_DIR"
  cp -f "$USB/services/receipt-ocr/server.js" \
        "$USB/services/receipt-ocr/parse-receipt-text.js" \
        "$USB/services/receipt-ocr/package.json" \
        "$APP_DIR/"
else
  warn "Clé USB introuvable — on répare $APP_DIR seulement"
fi

# Fix connu st-hubert (syntaxe JS)
if [ -f "$APP_DIR/parse-receipt-text.js" ]; then
  sed -i "s/st-hubert:/'st-hubert':/" "$APP_DIR/parse-receipt-text.js" 2>/dev/null || true
fi

echo "--- Vérification syntaxe JS ---"
node --check "$APP_DIR/parse-receipt-text.js" || err "parse-receipt-text.js invalide"
node --check "$APP_DIR/server.js" || err "server.js invalide"
ok "Syntaxe JS OK"

id chantiertrack &>/dev/null || useradd -r -s /bin/false chantiertrack
chown -R chantiertrack:chantiertrack "$APP_DIR"

echo "--- npm install ---"
(cd "$APP_DIR" && sudo -u chantiertrack npm install --omit=dev 2>&1) || warn "npm install a échoué — vérifiez node/npm"

echo "--- Redémarrage service ---"
systemctl daemon-reload
systemctl restart chantiertrack-ocr
sleep 2

if systemctl is-active --quiet chantiertrack-ocr; then
  ok "Service actif"
else
  err "Service toujours en échec — voir: journalctl -u chantiertrack-ocr -n 30 --no-pager"
fi

echo ""
echo "--- Test direct port 3101 ---"
curl -sf "http://127.0.0.1:3101/health" && echo "" || {
  warn "3101 ne répond pas"
  journalctl -u chantiertrack-ocr -n 15 --no-pager
  exit 1
}

echo "--- Test via Nginx 8888 ---"
if curl -sf "http://127.0.0.1:8888/ocr/health" >/dev/null 2>&1; then
  ok "8888/ocr/health OK"
  curl -s "http://127.0.0.1:8888/ocr/health"
  echo ""
else
  warn "8888/ocr/health échoue — vérifiez Nginx location /ocr/"
fi

ok "OCR réparé"
