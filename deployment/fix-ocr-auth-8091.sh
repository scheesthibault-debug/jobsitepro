#!/bin/bash
# Fix OCR HTTP 401 — service OCR vérifie le token sur le mauvais PocketBase (8090 vs 8091)
# Usage: sudo bash deployment/fix-ocr-auth-8091.sh

set -e
APP_DIR="${APP_DIR:-/opt/chantiertrack}"
ENV_FILE="$APP_DIR/receipt-ocr/.env"
PB_URL="${POCKETBASE_URL:-http://127.0.0.1:8091}"

[ "$(id -u)" -eq 0 ] || { echo "sudo requis"; exit 1; }

if [ ! -f "$ENV_FILE" ]; then
  echo "Fichier $ENV_FILE introuvable — lancez install-receipt-ocr.sh d'abord"
  exit 1
fi

if grep -q '^POCKETBASE_URL=' "$ENV_FILE"; then
  sed -i "s|^POCKETBASE_URL=.*|POCKETBASE_URL=$PB_URL|" "$ENV_FILE"
else
  echo "POCKETBASE_URL=$PB_URL" >> "$ENV_FILE"
fi

# systemd peut aussi surcharger
if [ -f /etc/systemd/system/chantiertrack-ocr.service ]; then
  if grep -q 'POCKETBASE_URL=' /etc/systemd/system/chantiertrack-ocr.service; then
    sed -i "s|POCKETBASE_URL=.*|POCKETBASE_URL=$PB_URL|" /etc/systemd/system/chantiertrack-ocr.service
  fi
  systemctl daemon-reload
fi

chown chantiertrack:chantiertrack "$ENV_FILE" 2>/dev/null || true
systemctl restart chantiertrack-ocr
sleep 2

echo "=== OCR auth fix ==="
echo "POCKETBASE_URL=$PB_URL"
curl -s http://127.0.0.1:3101/health
echo ""
echo ""
echo "Testez le scan dans l'app employé (reconnectez-vous si besoin)."
