#!/bin/bash
# Fix scan complet : OCR → PocketBase 8091 + auth optionnelle + test
# Usage: sudo bash deployment/fix-ocr-scan-complet.sh

set -e
APP_DIR="${APP_DIR:-/opt/chantiertrack}"
ENV="$APP_DIR/receipt-ocr/.env"

[ "$(id -u)" -eq 0 ] || { echo "sudo requis"; exit 1; }

echo "=== Fix OCR scan JobsitePro ==="

# 1) PocketBase 8091 (même base que login)
if [ -f "$ENV" ]; then
  grep -q '^POCKETBASE_URL=' "$ENV" \
    && sed -i 's|^POCKETBASE_URL=.*|POCKETBASE_URL=http://127.0.0.1:8091|' "$ENV" \
    || echo 'POCKETBASE_URL=http://127.0.0.1:8091' >> "$ENV"
  if ! grep -q '^REQUIRE_AUTH=' "$ENV"; then
    echo 'REQUIRE_AUTH=false' >> "$ENV"
  else
    sed -i 's|^REQUIRE_AUTH=.*|REQUIRE_AUTH=false|' "$ENV"
  fi
  echo "[OK] .env → POCKETBASE_URL=8091, REQUIRE_AUTH=false (MVP)"
fi

systemctl restart chantiertrack-ocr 2>/dev/null || true
sleep 2

echo ""
echo "--- Health ---"
curl -sf http://127.0.0.1:3101/health && echo "" || echo "OCR 3101 ECHEC"

echo ""
echo "--- Scan test sans auth (doit ok:true ou partial) ---"
# 1x1 pixel JPEG minimal
B64="/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k="
curl -s -X POST http://127.0.0.1:3101/scan-receipt \
  -H 'Content-Type: application/json' \
  -d "{\"imageBase64\":\"$B64\",\"mimeType\":\"image/jpeg\"}" | head -c 400
echo ""

echo ""
echo "--- Via Nginx 8888 ---"
curl -sf http://127.0.0.1:8888/api/jobsitepro/ocr-health | head -c 150
echo ""

echo ""
echo "Sur téléphone : vider cache PWA ou navigation privée, reconnectez-vous, rescannez."
echo "Logs OCR : journalctl -u chantiertrack-ocr -n 20 --no-pager"
