#!/bin/bash
# JobsitePro — Installe le service OCR reçus (lie employé → PocketBase)
# Usage: sudo bash deployment/install-receipt-ocr.sh
# Prérequis: PocketBase déjà sur /opt/chantiertrack (port 8090)

set -e
APP_DIR="${APP_DIR:-/opt/chantiertrack}"
OCR_PORT="${OCR_PORT:-3101}"
PB_PORT="${PB_PORT:-8090}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

[ "$(id -u)" -eq 0 ] || { echo "sudo requis"; exit 1; }

echo "[ocr] Copie services/receipt-ocr → $APP_DIR/receipt-ocr"
mkdir -p "$APP_DIR/receipt-ocr"
cp -f "$SCRIPT_DIR/services/receipt-ocr/package.json" \
      "$SCRIPT_DIR/services/receipt-ocr/server.js" \
      "$SCRIPT_DIR/services/receipt-ocr/parse-receipt-text.js" \
      "$APP_DIR/receipt-ocr/"
if [ -f "$SCRIPT_DIR/services/receipt-ocr/.env" ]; then
  cp -f "$SCRIPT_DIR/services/receipt-ocr/.env" "$APP_DIR/receipt-ocr/"
elif [ ! -f "$APP_DIR/receipt-ocr/.env" ]; then
  cp -f "$SCRIPT_DIR/services/receipt-ocr/.env.example" "$APP_DIR/receipt-ocr/.env"
  echo "[!] Éditez $APP_DIR/receipt-ocr/.env → GOOGLE_AI_API_KEY= (gratuit: aistudio.google.com/apikey)"
fi

id chantiertrack &>/dev/null || useradd -r -s /bin/false chantiertrack
chown -R chantiertrack:chantiertrack "$APP_DIR/receipt-ocr"
(cd "$APP_DIR/receipt-ocr" && sudo -u chantiertrack npm install --omit=dev)

cat > /etc/systemd/system/chantiertrack-ocr.service << EOF
[Unit]
Description=JobsitePro Receipt OCR
After=network.target chantiertrack.service

[Service]
Type=simple
User=chantiertrack
Group=chantiertrack
WorkingDirectory=$APP_DIR/receipt-ocr
Environment=PORT=$OCR_PORT
Environment=POCKETBASE_URL=http://127.0.0.1:8091
Environment=REQUIRE_AUTH=false
ExecStart=/usr/bin/node $APP_DIR/receipt-ocr/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable chantiertrack-ocr
systemctl restart chantiertrack-ocr

# Nginx — ajoute location /ocr/ si absente
NGINX_SITE="/etc/nginx/sites-available/chantiertrack"
if [ -f "$NGINX_SITE" ] && ! grep -q 'location /ocr/' "$NGINX_SITE"; then
  sed -i "/location \/push\//i\\
    location /ocr/ {\\
        proxy_pass http://127.0.0.1:$OCR_PORT/;\\
        proxy_set_header Host \\\$host;\\
        proxy_set_header X-Real-IP \\\$remote_addr;\\
        client_max_body_size 20M;\\
    }\\
" "$NGINX_SITE"
  nginx -t && systemctl reload nginx
  echo "[ocr] Nginx location /ocr/ ajoutée"
else
  echo "[!] Ajoutez manuellement dans Nginx:"
  echo "    location /ocr/ { proxy_pass http://127.0.0.1:$OCR_PORT/; ... }"
fi

curl -s "http://127.0.0.1:$OCR_PORT/health" && echo ""
echo "[✓] OCR prêt — employé appelle https://VOTRE-DOMAINE/ocr/scan-receipt"
