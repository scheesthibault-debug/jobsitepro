#!/usr/bin/env bash
# Installe le service contact-mail JobsitePro (systemd + npm)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SVC_DIR="$ROOT/services/contact-mail"
UNIT=/etc/systemd/system/jobsitepro-contact-mail.service
ENV_FILE="$SVC_DIR/.env"

echo "=== JobsitePro contact-mail ==="
echo "Dossier: $SVC_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$SVC_DIR/.env.example" "$ENV_FILE"
  echo "Créé $ENV_FILE — éditez SMTP et CONTACT_TO avant de démarrer."
fi

cd "$SVC_DIR"
npm install --omit=dev

sudo tee "$UNIT" > /dev/null <<EOF
[Unit]
Description=JobsitePro contact form mail API
After=network.target

[Service]
Type=simple
WorkingDirectory=$SVC_DIR
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable jobsitepro-contact-mail
sudo systemctl restart jobsitepro-contact-mail
sudo systemctl status jobsitepro-contact-mail --no-pager || true

echo ""
echo "Nginx (NPM) — ajouter location:"
echo "  /contact/  →  http://127.0.0.1:3103/"
echo "Test: curl -s http://127.0.0.1:3103/health"
