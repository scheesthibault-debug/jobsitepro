#!/usr/bin/env bash
# JobsitePro integrations-hub — sans sudo (utilisateur titi)
# QuickBooks sync API — port 3102
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HUB_DIR="$ROOT/services/integrations-hub"
ENV_FILE="$HUB_DIR/.env"
LOG_DIR="$HOME/.jobsitepro"
PID_FILE="$LOG_DIR/integrations-hub.pid"
LOG_FILE="$LOG_DIR/integrations-hub.log"
PORT="${INTEGRATIONS_PORT:-3102}"

mkdir -p "$LOG_DIR"

if [[ ! -d "$HUB_DIR" ]]; then
  echo "ERREUR: $HUB_DIR introuvable."
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$HUB_DIR/.env.example" "$ENV_FILE"
  sed -i "s/^PORT=.*/PORT=$PORT/" "$ENV_FILE" 2>/dev/null || \
    sed -i '' "s/^PORT=.*/PORT=$PORT/" "$ENV_FILE" 2>/dev/null || true
  echo "Créé $ENV_FILE"
  echo "Éditez POCKETBASE_ADMIN_TOKEN + QUICKBOOKS_CLIENT_ID/SECRET puis relancez."
  exit 1
fi

if ! grep -q '^POCKETBASE_ADMIN_TOKEN=.\+' "$ENV_FILE"; then
  echo "Éditez $ENV_FILE : POCKETBASE_ADMIN_TOKEN obligatoire."
  echo "PocketBase Admin → Settings → Token (ou créer un superuser API token)."
  exit 1
fi

NODE_MAJOR="$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1 || echo 0)"
if [[ "${NODE_MAJOR:-0}" -lt 20 ]]; then
  echo "ERREUR: Node 20+ requis (actuel: $(node -v 2>/dev/null || echo absent))."
  echo "  nvm install 20 && nvm use 20"
  echo "  ou: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs"
  exit 1
fi

cd "$HUB_DIR"
npm install --no-bin-links

if [[ -f dist/index.js ]]; then
  echo "Build OK — dist/index.js présent"
elif [[ -f node_modules/typescript/bin/tsc ]]; then
  node ./node_modules/typescript/bin/tsc
else
  npm install typescript --no-bin-links --save-dev
  node ./node_modules/typescript/bin/tsc
fi

npm prune --omit=dev 2>/dev/null || true

if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "Arrêt ancien hub $(cat "$PID_FILE")…"
  kill "$(cat "$PID_FILE")" || true
  sleep 1
fi

nohup node dist/index.js >> "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"
sleep 2

if curl -sf "http://127.0.0.1:$PORT/health" >/dev/null; then
  echo "OK — integrations-hub (PID $(cat "$PID_FILE")) port $PORT"
  curl -s "http://127.0.0.1:$PORT/health"
  echo ""
  echo "Log: $LOG_FILE"
  echo "Nginx: location /integrations/ → http://127.0.0.1:$PORT/"
else
  echo "WARN: health échoué. tail -30 $LOG_FILE"
  exit 1
fi
