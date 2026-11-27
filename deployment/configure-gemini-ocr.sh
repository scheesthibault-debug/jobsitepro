#!/bin/bash
# Configure la clé Gemini (gratuite) pour le scan de reçus
# Usage: sudo bash deployment/configure-gemini-ocr.sh
#    ou: sudo bash deployment/configure-gemini-ocr.sh "AIzaSy..."

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
  echo "=== Clé API Gemini (gratuite) ==="
  echo "1. Ouvrez https://aistudio.google.com/apikey"
  echo "2. Create API key"
  echo "3. Collez la clé ci-dessous (AIza… ou AQ. — Google AI Studio)"
  echo ""
  read -r -p "GOOGLE_AI_API_KEY: " KEY
fi

KEY="$(echo "$KEY" | tr -d '[:space:]')"
if [ -z "$KEY" ]; then
  echo "Clé vide — annulé"
  exit 1
fi
if [[ ! "$KEY" =~ ^(AIza|AQ\.) ]]; then
  echo ""
  echo "[!] Format inhabituel — clé attendue depuis https://aistudio.google.com/apikey"
  echo "    (préfixes valides: AIza… ou AQ.…)"
  read -r -p "Continuer quand même ? (o/N) " ok
  [[ "$ok" =~ ^[oOyY] ]] || exit 1
fi

mkdir -p "$APP_DIR/receipt-ocr"
PB_URL="${POCKETBASE_URL:-http://127.0.0.1:8091}"

cat > "$ENV_FILE" << EOF
OCR_PROVIDER=gemini
GOOGLE_AI_API_KEY=$KEY
GEMINI_MODEL=gemini-2.0-flash
PORT=3101
POCKETBASE_URL=$PB_URL
REQUIRE_AUTH=true
OCR_FALLBACK=gemini,ocrspace
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
curl -s "http://127.0.0.1:3101/health" || echo "(service pas démarré — lancez install-receipt-ocr.sh)"
echo ""
echo "[✓] Clé enregistrée dans $ENV_FILE"
