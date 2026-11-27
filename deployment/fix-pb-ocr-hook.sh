#!/bin/bash
# Active le hook scan OCR dans PocketBase (pb_data/pb_hooks)
# Usage: sudo bash deployment/fix-pb-ocr-hook.sh

set -e
APP_DIR="${APP_DIR:-/opt/chantiertrack}"
USB="${USB_ROOT:-/mnt/stockage/chantiertrack-v2/chantiertrack-v2}"

[ "$(id -u)" -eq 0 ] || { echo "sudo requis"; exit 1; }

SRC=""
for c in "$USB/pocketbase/pb_hooks/receipt_ocr_proxy.pb.js" \
         "$APP_DIR/pb_hooks/receipt_ocr_proxy.pb.js"; do
  [ -f "$c" ] && SRC="$c" && break
done

[ -n "$SRC" ] || { echo "Hook introuvable — copiez pocketbase/pb_hooks depuis le PC"; exit 1; }

mkdir -p "$APP_DIR/pb_hooks" "$APP_DIR/pb_data/pb_hooks"
cp -f "$SRC" "$APP_DIR/pb_hooks/receipt_ocr_proxy.pb.js"
cp -f "$SRC" "$APP_DIR/pb_data/pb_hooks/receipt_ocr_proxy.pb.js"
chown -R chantiertrack:chantiertrack "$APP_DIR/pb_hooks" "$APP_DIR/pb_data/pb_hooks" 2>/dev/null || true

if [ -f /etc/systemd/system/chantiertrack.service ] && ! grep -q 'hooksDir' /etc/systemd/system/chantiertrack.service; then
  sed -i "s|serve --http=|serve --hooksDir=$APP_DIR/pb_data/pb_hooks --http=|" /etc/systemd/system/chantiertrack.service
  systemctl daemon-reload
  echo "[OK] systemd hooksDir ajouté"
fi

systemctl restart chantiertrack
sleep 3

echo "=== Test hook ==="
echo -n "Gemini 3101: "
curl -sf http://127.0.0.1:3101/health | grep -q gemini && echo OK || echo ECHEC
echo -n "Hook PB:    "
curl -sf http://127.0.0.1:8090/api/jobsitepro/ocr-health | head -c 200
echo ""
