#!/usr/bin/env bash
# Copie les hooks OAuth QuickBooks vers PocketBase pb_hooks
# Usage: sudo bash deployment/install-qb-hooks.sh
#        ou sans sudo si APP_DIR accessible en écriture
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="${APP_DIR:-/opt/chantiertrack}"
HOOKS_SRC="$ROOT/pocketbase/pb_hooks"

HOOKS=(
  oauth_connectors.pb.js
  qb_document_router.pb.js
)

echo "=== JobsitePro — hooks QuickBooks ==="

for h in "${HOOKS[@]}"; do
  if [[ ! -f "$HOOKS_SRC/$h" ]]; then
    echo "ERREUR: $HOOKS_SRC/$h manquant"
    exit 1
  fi
done

for DEST in "$APP_DIR/pb_hooks" "$APP_DIR/pb_data/pb_hooks"; do
  mkdir -p "$DEST"
  for h in "${HOOKS[@]}"; do
    cp -f "$HOOKS_SRC/$h" "$DEST/$h"
    echo "  OK $DEST/$h"
  done
done

if [[ -f /etc/systemd/system/chantiertrack.service ]] && ! grep -q 'hooksDir' /etc/systemd/system/chantiertrack.service; then
  if [[ "$(id -u)" -eq 0 ]]; then
    sed -i "s|serve --http=|serve --hooksDir=$APP_DIR/pb_data/pb_hooks --http=|" /etc/systemd/system/chantiertrack.service
    systemctl daemon-reload
    systemctl restart chantiertrack
    echo "[OK] PocketBase redémarré avec hooksDir"
  else
    echo "WARN: ajoutez --hooksDir=$APP_DIR/pb_data/pb_hooks au service PocketBase (sudo)"
  fi
else
  echo "Redémarrez PocketBase pour charger les hooks."
fi

echo ""
echo "Variables PocketBase requises (docker/systemd):"
echo "  QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET"
echo "  QUICKBOOKS_REDIRECT_URI=https://jobsitepro.example.com/api/jobsitepro/oauth/quickbooks/callback"
echo "  QUICKBOOKS_ENVIRONMENT=sandbox"
echo "  PATRON_APP_URL=https://jobsitepro.example.com/patron/"
