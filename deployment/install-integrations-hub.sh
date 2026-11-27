#!/bin/bash
# JobsitePro — Installe integrations-hub (QuickBooks OAuth + sync)
# Usage: sudo bash deployment/install-integrations-hub.sh
# Port 3102 (ne pas utiliser 3101 = receipt-ocr)

set -e
APP_DIR="${APP_DIR:-/opt/chantiertrack}"
HUB_PORT="${HUB_PORT:-3102}"
PB_PORT="${PB_PORT:-8090}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$SCRIPT_DIR/services/integrations-hub"
DEST="$APP_DIR/integrations-hub"

[ "$(id -u)" -eq 0 ] || { echo "sudo requis"; exit 1; }
[ -d "$SRC" ] || { echo "integrations-hub introuvable: $SRC"; exit 1; }

echo "[hub] Copie → $DEST"
mkdir -p "$DEST"
rsync -a --delete \
  --exclude node_modules --exclude dist \
  "$SRC/" "$DEST/"

id chantiertrack &>/dev/null || useradd -r -s /bin/false chantiertrack

if [ ! -f "$DEST/.env" ]; then
  cp "$DEST/.env.example" "$DEST/.env"
  sed -i "s/^PORT=.*/PORT=$HUB_PORT/" "$DEST/.env"
  echo "[!] Éditez $DEST/.env (QUICKBOOKS_*, POCKETBASE_ADMIN_TOKEN)"
fi

echo "[hub] npm install + build..."
(cd "$DEST" && sudo -u chantiertrack npm install && sudo -u chantiertrack npm run build)
chown -R chantiertrack:chantiertrack "$DEST"

cat > /etc/systemd/system/jobsitepro-integrations.service << EOF
[Unit]
Description=JobsitePro Integrations Hub (QuickBooks)
After=network.target chantiertrack.service

[Service]
Type=simple
User=chantiertrack
Group=chantiertrack
WorkingDirectory=$DEST
EnvironmentFile=$DEST/.env
ExecStart=$(command -v node) $DEST/dist/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable jobsitepro-integrations
systemctl restart jobsitepro-integrations
sleep 2

if curl -sf "http://127.0.0.1:$HUB_PORT/health" >/dev/null; then
  echo "[✓] integrations-hub OK sur port $HUB_PORT"
else
  echo "[!] Health check échoué — journalctl -u jobsitepro-integrations -n 20"
fi

echo ""
echo "NPM : ajouter location /integrations/ → http://127.0.0.1:$HUB_PORT/"
echo "Voir deployment/DEPLOIEMENT-VPS-JOBSITEPRO.md"
