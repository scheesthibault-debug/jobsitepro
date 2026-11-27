#!/bin/bash
# URGENT — PocketBase en crash loop + scan sans hooks PB
# Usage: cd .../chantiertrack-v2 && sudo bash deployment/fix-pb-crash-urgent.sh

set -e
APP_DIR="${APP_DIR:-/opt/chantiertrack}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SVC="/etc/systemd/system/chantiertrack.service"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

[ "$(id -u)" -eq 0 ] || err "sudo requis"

echo "=== JobsitePro — réparation PocketBase + scan Nginx ==="

# 1) Sauvegarde pb_data
BK="$APP_DIR/backups/pb_data_$(date +%Y%m%d_%H%M%S).tar.gz"
mkdir -p "$APP_DIR/backups"
if [ -d "$APP_DIR/pb_data" ]; then
  tar -czf "$BK" -C "$APP_DIR" pb_data
  log "Sauvegarde: $BK"
else
  warn "pb_data introuvable"
fi

# 2) Restaurer ExecStart propre (SANS hooksDir — évite crash + hooks inutiles)
systemctl stop chantiertrack 2>/dev/null || true

if [ -f "$SVC" ]; then
  PB_PORT="${PB_PORT:-8090}"
  cat > "$SVC" << EOF
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
  systemctl daemon-reload
  log "Service systemd réécrit (sans hooksDir)"
fi

# 3) Démarrer PocketBase
systemctl start chantiertrack
sleep 4

if systemctl is-active --quiet chantiertrack; then
  log "PocketBase actif"
else
  warn "PocketBase ne démarre pas — voir journal ci-dessous"
  journalctl -u chantiertrack -n 15 --no-pager
  echo ""
  warn "Migration échouée? Sauvegarde dans $BK"
  warn "Cause fréquente: binaire PocketBase trop récent pour vieille pb_data."
  warn "Solution: remettre l'ancien binaire pocketbase OU upgrade par étapes (0.13 → 0.16 → latest)."
  warn "NE PAS supprimer pb_data — contient toutes vos données."
  exit 1
fi

# 4) Nginx bypass scan (sans hook PocketBase)
if [ -f "$ROOT/deployment/fix-scan-nginx-bypass.sh" ]; then
  bash "$ROOT/deployment/fix-scan-nginx-bypass.sh"
else
  warn "fix-scan-nginx-bypass.sh absent — recopiez deployment/ depuis le PC"
fi

echo ""
echo "=== Tests ==="
echo -n "PB API:        "
curl -sf "http://127.0.0.1:8090/api/health" >/dev/null && echo OK || echo ECHEC
echo -n "OCR Gemini:    "
curl -sf http://127.0.0.1:3101/health | grep -q gemini && echo OK || echo ECHEC
echo -n "Scan Nginx:    "
curl -sf http://127.0.0.1:8888/api/jobsitepro/ocr-health | head -c 120
echo ""
echo ""
log "Le scan passe par Nginx:8888 → OCR:3101 (hook PB non requis)"
warn "HTTPS public: NPM → port 8888 (voir deployment/NPM-FIX-URGENT.md)"
