#!/bin/bash
# Le service systemd écrase .env — POCKETBASE_URL restait sur 8090
# Usage: sudo bash deployment/fix-ocr-systemd-8091.sh

set -e
SVC="/etc/systemd/system/chantiertrack-ocr.service"
ENV_FILE="/opt/chantiertrack/receipt-ocr/.env"
NGINX="/etc/nginx/sites-available/chantiertrack"

[ "$(id -u)" -eq 0 ] || { echo "sudo requis"; exit 1; }

echo "=== Fix OCR systemd + nginx jobsitepro ==="

# 1) .env
mkdir -p "$(dirname "$ENV_FILE")"
touch "$ENV_FILE"
grep -q '^POCKETBASE_URL=' "$ENV_FILE" \
  && sed -i 's|^POCKETBASE_URL=.*|POCKETBASE_URL=http://127.0.0.1:8091|' "$ENV_FILE" \
  || echo 'POCKETBASE_URL=http://127.0.0.1:8091' >> "$ENV_FILE"
grep -q '^REQUIRE_AUTH=' "$ENV_FILE" \
  && sed -i 's|^REQUIRE_AUTH=.*|REQUIRE_AUTH=false|' "$ENV_FILE" \
  || echo 'REQUIRE_AUTH=false' >> "$ENV_FILE"

# 2) systemd — c'est LUI qui gardait 8090 dans /health
if [ -f "$SVC" ]; then
  if grep -q 'POCKETBASE_URL=' "$SVC"; then
    sed -i 's|Environment=POCKETBASE_URL=.*|Environment=POCKETBASE_URL=http://127.0.0.1:8091|' "$SVC"
  else
    sed -i '/\[Service\]/a Environment=POCKETBASE_URL=http://127.0.0.1:8091' "$SVC"
  fi
  if grep -q 'REQUIRE_AUTH=' "$SVC"; then
    sed -i 's|Environment=REQUIRE_AUTH=.*|Environment=REQUIRE_AUTH=false|' "$SVC"
  else
    sed -i '/Environment=POCKETBASE_URL/a Environment=REQUIRE_AUTH=false' "$SVC"
  fi
  systemctl daemon-reload
fi

systemctl restart chantiertrack-ocr
sleep 2

# 3) nginx — jobsitepro/ocr-health (404 sur 8888)
if [ -f "$NGINX" ] && ! grep -q 'jobsitepro/ocr-health' "$NGINX"; then
  python3 << 'PY'
from pathlib import Path
p = Path("/etc/nginx/sites-available/chantiertrack")
text = p.read_text()
block = """
    location = /api/jobsitepro/ocr-health {
        proxy_pass http://127.0.0.1:3101/health;
        proxy_set_header Host $host;
        proxy_set_header Authorization $http_authorization;
        proxy_read_timeout 30s;
    }
    location = /api/jobsitepro/scan-receipt {
        proxy_pass http://127.0.0.1:3101/scan-receipt;
        proxy_set_header Host $host;
        proxy_set_header Authorization $http_authorization;
        proxy_read_timeout 120s;
        client_max_body_size 20M;
    }
"""
if "jobsitepro/ocr-health" not in text:
    text = text.replace("    location /api/ {", block + "\n    location /api/ {", 1)
    p.write_text(text)
    print("[OK] nginx jobsitepro ajouté")
else:
    print("[OK] nginx jobsitepro déjà présent")
PY
  nginx -t && systemctl reload nginx
fi

echo ""
echo "--- Vérification ---"
echo -n "Health OCR:     "
curl -s http://127.0.0.1:3101/health
echo ""
echo -n "8888 jobsitepro:"
curl -s http://127.0.0.1:8888/api/jobsitepro/ocr-health | head -c 120
echo ""
echo ""
echo "Attendu health: \"pocketbase\":\"http://127.0.0.1:8091\" et \"auth\":false"
echo "Attendu 8888:   \"gemini\":true (pas 404)"
