#!/bin/bash
# Corrige Nginx qui ne démarre pas (port 80 occupé, site manquant, etc.)
# Usage: sudo bash deployment/fix-nginx.sh

set -e
SERVER_IP="${SERVER_IP:-127.0.0.1}"
APP_DIR="${APP_DIR:-/opt/chantiertrack}"
PB_PORT="${PB_PORT:-8090}"
PUSH_PORT="${PUSH_PORT:-3099}"
OCR_PORT="${OCR_PORT:-3101}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; }

[ "$(id -u)" -eq 0 ] || { err "sudo requis"; exit 1; }

echo "=== Diagnostic Nginx ==="
systemctl status nginx --no-pager 2>&1 | head -20 || true
echo ""
echo "Port 80 :"
ss -tlnp | grep ':80 ' || echo "(libre)"
echo ""
echo "Processus sur 80 :"
fuser -v 80/tcp 2>/dev/null || true

# Arrêter conflits courants (apache2)
if systemctl is-active apache2 &>/dev/null; then
  warn "Apache2 actif — arrêt pour libérer le port 80"
  systemctl stop apache2
  systemctl disable apache2 2>/dev/null || true
fi

# Ancienne instance nginx bloquée
systemctl stop nginx 2>/dev/null || true
pkill -9 nginx 2>/dev/null || true
sleep 1

log "Écriture site chantiertrack..."
mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled

cat > /etc/nginx/sites-available/chantiertrack << EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
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

# Désactiver autres sites qui écoutent aussi sur 80
for f in /etc/nginx/sites-enabled/*; do
  [ "$f" = "/etc/nginx/sites-enabled/chantiertrack" ] && continue
  [ -e "$f" ] || continue
  warn "Désactivation $(basename "$f")"
  rm -f "$f"
done

nginx -t
systemctl start nginx
systemctl enable nginx

if systemctl is-active nginx &>/dev/null; then
  log "Nginx démarré"
  curl -sI "http://127.0.0.1/" | head -3
  echo ""
  echo "URLs :"
  echo "  http://$SERVER_IP/patron/"
  echo "  http://$SERVER_IP/employe/"
  echo "  http://$SERVER_IP/_/"
else
  err "Nginx toujours en échec — envoyez :"
  echo "  journalctl -xeu nginx.service --no-pager | tail -40"
fi
