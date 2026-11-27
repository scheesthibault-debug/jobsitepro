#!/bin/bash
# Upgrade PocketBase par étapes pour pb_data ancienne (fix migration schema/indexes)
# Usage: sudo bash deployment/fix-pb-migration-step.sh
#
# ATTENTION: fait une sauvegarde avant. Ne pas interrompre.

set -e
APP_DIR="${APP_DIR:-/opt/chantiertrack}"
PB="$APP_DIR/pocketbase"
DATA="$APP_DIR/pb_data"
ARCH="linux_amd64"

[ "$(id -u)" -eq 0 ] || { echo "sudo requis"; exit 1; }
[ -d "$DATA" ] || { echo "pb_data introuvable"; exit 1; }

mkdir -p "$APP_DIR/backups"
BK="$APP_DIR/backups/pb_data_pre_migration_$(date +%Y%m%d_%H%M%S).tar.gz"
tar -czf "$BK" -C "$APP_DIR" pb_data
echo "[OK] Sauvegarde: $BK"

systemctl stop chantiertrack 2>/dev/null || true

download_pb() {
  local ver="$1"
  local tmp="/tmp/pb_${ver}.zip"
  echo ">>> Téléchargement PocketBase v${ver}..."
  curl -fsSL "https://github.com/pocketbase/pocketbase/releases/download/v${ver}/pocketbase_${ver}_${ARCH}.zip" -o "$tmp"
  unzip -o -q "$tmp" pocketbase -d /tmp/pb_step/
  chmod +x /tmp/pb_step/pocketbase
}

run_migrate() {
  local ver="$1"
  echo ">>> Migration avec v${ver}..."
  timeout 30 sudo -u chantiertrack /tmp/pb_step/pocketbase serve --http=127.0.0.1:8091 --dir="$DATA" &
  local pid=$!
  sleep 6
  if curl -sf http://127.0.0.1:8091/api/health >/dev/null 2>&1; then
    echo "[OK] v${ver} — serveur OK sur 8091"
    kill "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
    return 0
  fi
  kill "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
  echo "[ECHEC] v${ver} — voir logs ci-dessus"
  return 1
}

mkdir -p /tmp/pb_step

# Étapes recommandées PocketBase pour sauts de version
LAST_VER="0.25.9"
STEPS=(0.13.4 0.16.10 0.22.21 "$LAST_VER")

for ver in "${STEPS[@]}"; do
  download_pb "$ver" || { echo "Échec download v$ver"; exit 1; }
  if ! run_migrate "$ver"; then
    echo ""
    echo "[!] Bloqué à v${ver}. Restaurez si besoin:"
    echo "    sudo tar -xzf $BK -C $APP_DIR"
    exit 1
  fi
done

echo ">>> Installation binaire final v${LAST_VER}..."
cp -f /tmp/pb_step/pocketbase "$PB"
chown chantiertrack:chantiertrack "$PB"
chmod +x "$PB"

systemctl start chantiertrack
sleep 4

if systemctl is-active --quiet chantiertrack; then
  echo ""
  echo "[SUCCÈS] PocketBase actif"
  curl -sf http://127.0.0.1:8090/api/health && echo ""
else
  echo "[ECHEC] journalctl -u chantiertrack -n 20"
  journalctl -u chantiertrack -n 20 --no-pager
  exit 1
fi

rm -rf /tmp/pb_step
