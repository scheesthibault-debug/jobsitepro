#!/bin/bash
# Configure OCR.space (~25 000 scans/mois gratuits) pour JobsitePro
# Usage: sudo bash deployment/configure-ocrspace-ocr.sh
#    ou: sudo bash deployment/configure-ocrspace-ocr.sh "VOTRE_CLE"

set -e
APP_DIR="${APP_DIR:-/opt/chantiertrack}"
ENV_FILE="$APP_DIR/receipt-ocr/.env"

if [ "$(id -u)" -ne 0 ]; then
  echo "Lancez avec sudo"
  exit 1
fi

KEY="${1:-}"
if [ -z "$KEY" ]; then
  echo ""
  echo "=== Clé API OCR.space (gratuite, ~25 000 req/mois) ==="
  echo "1. Ouvrez https://ocr.space/ocrapi"
  echo "2. Créez un compte gratuit"
  echo "3. Copiez votre API key (pas « helloworld » — trop limitée)"
  echo ""
  read -r -p "OCR_SPACE_API_KEY: " KEY
fi

KEY="$(echo "$KEY" | tr -d '[:space:]')"
if [ -z "$KEY" ] || [ "$KEY" = "helloworld" ]; then
  echo "Clé invalide — utilisez votre clé personnelle depuis ocr.space/ocrapi"
  exit 1
fi

mkdir -p "$APP_DIR/receipt-ocr"
PB_URL="${POCKETBASE_URL:-http://127.0.0.1:8090}"

cat > "$ENV_FILE" << EOF
OCR_PROVIDER=ocrspace
OCR_SPACE_API_KEY=$KEY
PORT=3101
POCKETBASE_URL=$PB_URL
REQUIRE_AUTH=true
OCR_FALLBACK=ocrspace,gemini
GEMINI_MODEL=gemini-2.0-flash
EOF

chown chantiertrack:chantiertrack "$ENV_FILE" 2>/dev/null || true
chmod 600 "$ENV_FILE"

if systemctl is-active chantiertrack-ocr &>/dev/null; then
  systemctl restart chantiertrack-ocr
elif [ -f /etc/systemd/system/chantiertrack-ocr.service ]; then
  systemctl start chantiertrack-ocr
fi

sleep 1
echo ""
echo "Test santé OCR :"
curl -s "http://127.0.0.1:3101/health" || echo "(service pas démarré)"
echo ""
echo "[✓] OCR.space configuré dans $ENV_FILE"
