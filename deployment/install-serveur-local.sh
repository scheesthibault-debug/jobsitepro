#!/bin/bash
# ChantierTrack — Installation sur serveur Ubuntu local (réseau LAN)
# Exemple : 127.0.0.1 — utilisateur titi
#
# Usage (sur le serveur Ubuntu, après avoir copié le projet) :
#   cd ~/chantiertrack-v2
#   sudo bash deployment/install-serveur-local.sh
#
# Variables (modifier si besoin) :
SERVER_IP="${SERVER_IP:-127.0.0.1}"
APP_DIR="${APP_DIR:-/opt/chantiertrack}"
PB_VERSION="${PB_VERSION:-0.22.4}"
PB_PORT="8090"
PUSH_PORT="3099"
OCR_PORT="3101"

set -e
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

[ "$(id -u)" -eq 0 ] || err "Lancez avec sudo : sudo bash deployment/install-serveur-local.sh"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "ChantierTrack — Installation serveur local"
echo "  IP      : $SERVER_IP"
echo "  Dossier : $APP_DIR"
echo ""

log "Paquets système..."
apt-get update -qq
apt-get install -y -qq nginx curl unzip nodejs npm 2>/dev/null || apt-get install -y -qq nginx curl unzip
if ! command -v node >/dev/null 2>&1; then
  warn "Node absent — installation via NodeSource..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
fi
node -v && npm -v

log "Dossiers $APP_DIR..."
mkdir -p "$APP_DIR/pb_public/patron" "$APP_DIR/pb_public/employe" "$APP_DIR/pb_data" "$APP_DIR/backups" "$APP_DIR/push"
id chantiertrack &>/dev/null || useradd -r -s /bin/false chantiertrack
chown -R chantiertrack:chantiertrack "$APP_DIR"

if [ ! -x "$APP_DIR/pocketbase" ]; then
  log "Téléchargement PocketBase v$PB_VERSION..."
  PB_URL="https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip"
  curl -L -o /tmp/pb.zip "$PB_URL"
  unzip -o /tmp/pb.zip pocketbase -d "$APP_DIR/"
  chmod +x "$APP_DIR/pocketbase"
  rm -f /tmp/pb.zip
else
  log "PocketBase déjà présent"
fi

log "Copie patron / employé..."
cp -f patron/index.html patron/sw.js patron/manifest.json "$APP_DIR/pb_public/patron/" 2>/dev/null || true
cp -rf patron/js patron/css "$APP_DIR/pb_public/patron/" 2>/dev/null || true
cp -f patron/icon-*.png patron/apple-touch-icon.png "$APP_DIR/pb_public/patron/" 2>/dev/null || true
cp -f employe/index.html employe/sw.js employe/manifest.json "$APP_DIR/pb_public/employe/" 2>/dev/null || true
cp -rf employe/js employe/css "$APP_DIR/pb_public/employe/" 2>/dev/null || true
cp -f employe/icon-*.png employe/apple-touch-icon.png "$APP_DIR/pb_public/employe/" 2>/dev/null || true
chown -R chantiertrack:chantiertrack "$APP_DIR/pb_public"

log "Service PocketBase..."
cat > /etc/systemd/system/chantiertrack.service << EOF
[Unit]
Description=ChantierTrack PocketBase
After=network.target

[Service]
Type=simple
User=chantiertrack
Group=chantiertrack
WorkingDirectory=$APP_DIR
ExecStart=$APP_DIR/pocketbase serve --http=127.0.0.1:$PB_PORT --dir=$APP_DIR/pb_data
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

log "Serveur push..."
cp -f push/package.json push/server.js push/generate-vapid.js "$APP_DIR/push/"
if [ -f push/vapid.json ]; then
  cp -f push/vapid.json "$APP_DIR/push/"
else
  (cd "$APP_DIR/push" && sudo -u chantiertrack npm install --omit=dev && sudo -u chantiertrack npm run vapid) || true
fi
chown -R chantiertrack:chantiertrack "$APP_DIR/push"
(cd "$APP_DIR/push" && sudo -u chantiertrack npm install --omit=dev) || warn "npm install push — refaire manuellement"

cat > /etc/systemd/system/chantiertrack-push.service << EOF
[Unit]
Description=ChantierTrack Web Push
After=network.target chantiertrack.service

[Service]
Type=simple
User=chantiertrack
Group=chantiertrack
WorkingDirectory=$APP_DIR/push
Environment=POCKETBASE_URL=http://127.0.0.1:$PB_PORT
Environment=PUSH_BIND=127.0.0.1
ExecStart=/usr/bin/node $APP_DIR/push/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

log "Service OCR reçus (optionnel — clé Gemini gratuite dans $APP_DIR/receipt-ocr/.env)..."
mkdir -p "$APP_DIR/receipt-ocr"
cp -f services/receipt-ocr/package.json services/receipt-ocr/server.js services/receipt-ocr/parse-receipt-text.js "$APP_DIR/receipt-ocr/" 2>/dev/null || true
[ -f services/receipt-ocr/.env.example ] && [ ! -f "$APP_DIR/receipt-ocr/.env" ] && cp -f services/receipt-ocr/.env.example "$APP_DIR/receipt-ocr/.env"
chown -R chantiertrack:chantiertrack "$APP_DIR/receipt-ocr"
if [ -f "$APP_DIR/receipt-ocr/package.json" ]; then
  (cd "$APP_DIR/receipt-ocr" && sudo -u chantiertrack npm install --omit=dev) || warn "npm install receipt-ocr"
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
Environment=POCKETBASE_URL=http://127.0.0.1:$PB_PORT
ExecStart=/usr/bin/node $APP_DIR/receipt-ocr/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
  systemctl enable chantiertrack-ocr 2>/dev/null || true
  systemctl restart chantiertrack-ocr 2>/dev/null || warn "OCR non démarré — ajoutez GOOGLE_AI_API_KEY (gratuit)"
fi

log "Nginx (HTTP sur $SERVER_IP)..."
cat > /etc/nginx/sites-available/chantiertrack << EOF
server {
    listen 80;
    server_name $SERVER_IP _;

    client_max_body_size 50M;

    location /push/ {
        proxy_pass http://127.0.0.1:$PUSH_PORT/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    location /ocr/ {
        proxy_pass http://127.0.0.1:$OCR_PORT/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        client_max_body_size 20M;
    }

    location / {
        proxy_pass http://127.0.0.1:$PB_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF
ln -sf /etc/nginx/sites-available/chantiertrack /etc/nginx/sites-enabled/chantiertrack
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
nginx -t

# Libérer le port 80 si Apache ou autre site Nginx bloque
if systemctl is-active apache2 &>/dev/null; then
  warn "Apache2 arrêté (port 80)"
  systemctl stop apache2 2>/dev/null || true
fi
for other in /etc/nginx/sites-enabled/*; do
  [ "$(basename "$other")" = "chantiertrack" ] && continue
  [ -e "$other" ] || continue
  rm -f "$other" 2>/dev/null && warn "Site désactivé: $(basename "$other")"
done

systemctl daemon-reload
systemctl enable chantiertrack chantiertrack-push chantiertrack-ocr nginx 2>/dev/null || systemctl enable chantiertrack chantiertrack-push nginx
systemctl restart chantiertrack
sleep 2
systemctl restart chantiertrack-push 2>/dev/null || true
systemctl restart chantiertrack-ocr 2>/dev/null || true
if ! systemctl restart nginx 2>/dev/null; then
  warn "Nginx n'a pas démarré — lancez: sudo bash deployment/fix-nginx.sh"
fi

echo ""
log "Installation terminée"
echo ""
echo "══════════════════════════════════════════════════════════"
echo "  URLs (depuis PC ou téléphone sur le même Wi‑Fi) :"
echo "  Admin PocketBase : http://$SERVER_IP/_/"
echo "  Patron           : http://$SERVER_IP/patron/"
echo "  Employé          : http://$SERVER_IP/employe/"
echo "  Test push        : http://$SERVER_IP/push/health"
echo "  OCR reçus        : http://$SERVER_IP/ocr/scan-receipt (POST)"
echo "══════════════════════════════════════════════════════════"
echo ""
warn "IMPORTANT — dans l’app, URL API = http://$SERVER_IP  (sans :8090)"
warn "Push : éditez $APP_DIR/push/vapid.json → adminToken (PocketBase Admin → Token API)"
echo "  sudo nano $APP_DIR/push/vapid.json"
echo "  sudo systemctl restart chantiertrack-push"
echo ""
curl -s "http://127.0.0.1/push/health" 2>/dev/null || curl -s "http://127.0.0.1:$PUSH_PORT/push/health" || warn "Push pas encore OK (adminToken ?)"
echo ""
