#!/bin/bash
# PocketBase crash loop — désactive hooks paie incompatibles + redémarre
# Usage: sudo bash deployment/fix-pb-redemarrer-maintenant.sh

set -e
APP_DIR="${APP_DIR:-/opt/chantiertrack}"
SVC="/etc/systemd/system/chantiertrack.service"

[ "$(id -u)" -eq 0 ] || { echo "sudo requis"; exit 1; }

echo "=== Fix PocketBase crash (hooks + service) ==="

systemctl stop chantiertrack 2>/dev/null || true

# Désactiver hooks qui crashent PB 0.22+ (onRecordAfterUpdate, onBootstrap, etc.)
for HOOKS in "$APP_DIR/pb_hooks" "$APP_DIR/pb_data/pb_hooks"; do
  [ -d "$HOOKS" ] || continue
  DISABLED="$HOOKS/_disabled_$(date +%Y%m%d)"
  mkdir -p "$DISABLED"
  for f in pay_stub_email.pb.js pay_stub_immutable.pb.js user_email_visibility.pb.js; do
    if [ -f "$HOOKS/$f" ]; then
      mv "$HOOKS/$f" "$DISABLED/"
      echo "[OK] Désactivé: $HOOKS/$f"
    fi
  done
done

# Garder receipt_ocr_proxy.pb.js (scan) — optionnel si Nginx bypass
# Si ça crashe encore, décommenter la ligne suivante :
# mv "$APP_DIR/pb_hooks/receipt_ocr_proxy.pb.js" "$APP_DIR/pb_hooks/_disabled/" 2>/dev/null || true

# Service propre SANS hooksDir
cat > "$SVC" << 'EOF'
[Unit]
Description=ChantierTrack PocketBase
After=network.target

[Service]
Type=simple
User=chantiertrack
Group=chantiertrack
WorkingDirectory=/opt/chantiertrack
ExecStart=/opt/chantiertrack/pocketbase serve --http=127.0.0.1:8090 --dir=/opt/chantiertrack/pb_data
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl start chantiertrack
sleep 5

echo ""
if systemctl is-active --quiet chantiertrack; then
  echo "[SUCCÈS] PocketBase actif"
  curl -sf http://127.0.0.1:8090/api/health && echo ""
else
  echo "[ECHEC] Migration DB probable — logs:"
  journalctl -u chantiertrack -n 12 --no-pager
  echo ""
  echo "Si 'no such column: schema' → sudo bash deployment/fix-pb-migration-step.sh"
  exit 1
fi

echo ""
echo "Scan OCR (sans hook PB):"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [ -f "$ROOT/deployment/fix-scan-nginx-bypass.sh" ]; then
  bash "$ROOT/deployment/fix-scan-nginx-bypass.sh"
else
  echo "  curl -s http://127.0.0.1:8888/api/jobsitepro/ocr-health"
  echo "  (lancez fix-scan-nginx-bypass.sh si absent)"
fi
