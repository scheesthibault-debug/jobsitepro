#!/bin/bash
# Diagnostic + réparation PocketBase crash loop (migration schema/indexes)
# Usage: sudo bash deployment/diagnostic-pb-crash.sh

APP_DIR="${APP_DIR:-/opt/chantiertrack}"
PB="$APP_DIR/pocketbase"
DATA="$APP_DIR/pb_data"

echo "=== Diagnostic PocketBase ==="
echo ""

echo "--- Binaire ---"
if [ -x "$PB" ]; then
  "$PB" --version 2>/dev/null || "$PB" version 2>/dev/null || ls -la "$PB"
else
  echo "MANQUANT: $PB"
fi

echo ""
echo "--- Service ---"
systemctl is-active chantiertrack 2>/dev/null || echo "inactive"
systemctl show chantiertrack -p NRestarts --value 2>/dev/null | xargs -I{} echo "Redémarrages: {}"

echo ""
echo "--- Derniers logs ---"
journalctl -u chantiertrack -n 25 --no-pager 2>/dev/null || true

echo ""
echo "--- Test manuel (5 sec) ---"
systemctl stop chantiertrack 2>/dev/null || true
sleep 1
if [ -x "$PB" ]; then
  timeout 8 sudo -u chantiertrack "$PB" serve --http=127.0.0.1:8090 --dir="$DATA" 2>&1 | head -20 || true
else
  echo "Impossible — binaire absent"
fi

echo ""
echo "--- Sauvegardes disponibles ---"
ls -lt "$APP_DIR/backups/"*.tar.gz 2>/dev/null | head -5 || echo "(aucune)"

echo ""
echo "=== Pistes de fix ==="
echo "1. Si migration 'no such column: schema' → binaire PB trop récent pour pb_data"
echo "   sudo bash deployment/fix-pb-migration-step.sh"
echo ""
echo "2. Restaurer sauvegarde d'hier (si existait avant le crash):"
echo "   sudo systemctl stop chantiertrack"
echo "   sudo tar -xzf BACKUP.tar.gz -C $APP_DIR"
echo "   sudo systemctl start chantiertrack"
echo ""
echo "3. Scan OCR fonctionne SANS PocketBase hook:"
echo "   sudo bash deployment/fix-scan-nginx-bypass.sh"
