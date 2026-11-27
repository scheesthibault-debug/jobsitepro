#!/usr/bin/env bash
# JobsitePro — ta vraie base est Docker sur 8091 (pas chantiertrack systemd 8090)
# Le service chantiertrack crash à cause de vieux hooks + migration.
# Usage: cd .../chantiertrack-v2 && sudo bash deployment/fix-utiliser-docker-8091.sh

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }

echo "=== Stabiliser JobsitePro sur Docker 8091 ==="

# 1) Arrêter la boucle crash sur 8090 (systemd — inutile si Docker 8091 = prod)
if systemctl is-active --quiet chantiertrack 2>/dev/null; then
  systemctl stop chantiertrack
  log "Service chantiertrack (8090) arrêté"
fi
if systemctl is-enabled --quiet chantiertrack 2>/dev/null; then
  systemctl disable chantiertrack
  log "Service chantiertrack désactivé au boot"
fi

# 2) Désactiver les hooks PB cassés (évite crash si tu redémarres 8090 un jour)
APP_DIR="${APP_DIR:-/opt/chantiertrack}"
HOOKS="$APP_DIR/pb_data/pb_hooks"
if [ -d "$HOOKS" ]; then
  mkdir -p "$HOOKS/_disabled"
  for f in pay_stub_email.pb.js pay_stub_immutable.pb.js user_email_visibility.pb.js receipt_ocr_proxy.pb.js; do
    [ -f "$HOOKS/$f" ] && mv -f "$HOOKS/$f" "$HOOKS/_disabled/" && log "Hook désactivé: $f"
  done
fi

# 3) Vérifier Docker 8091
echo ""
echo "--- Port 8091 (Docker = prod) ---"
if curl -sf http://127.0.0.1:8091/api/health >/dev/null; then
  log "8091 API healthy"
else
  warn "8091 ne répond pas — redémarrer le conteneur Docker PocketBase (Dockge/Portainer)"
  docker ps --format 'table {{.Names}}\t{{.Ports}}\t{{.Status}}' 2>/dev/null | grep -E '8091|pocket|NAME' || true
  exit 1
fi

echo -n "  expenses: "
curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:8091/api/collections/expenses/records?perPage=1"

echo -n "  login test: "
LOGIN=$(curl -s -X POST "http://127.0.0.1:8091/api/collections/users/auth-with-password" \
  -H 'Content-Type: application/json' \
  -d '{"identity":"test@example.com","password":"YOUR_PASSWORD"}')
if echo "$LOGIN" | grep -q '"token"'; then
  log "OK"
else
  warn "Échec — vérifier mot de passe dans admin 8091"
fi

# 4) Nginx 8888 → 8091 (scan + apps)
NGINX="/etc/nginx/sites-available/chantiertrack"
if [ -f "$NGINX" ] && grep -q '127.0.0.1:8090' "$NGINX"; then
  sed -i 's|proxy_pass http://127.0.0.1:8090;|proxy_pass http://127.0.0.1:8091;|g' "$NGINX"
  nginx -t && systemctl reload nginx
  log "Nginx 8888 → 8091"
fi

echo ""
echo "=== NPM (panneau serveur-maison) ==="
echo "  jobsitepro.example.com  *              →  http://127.0.0.1:8091"
echo "  jobsitepro.example.com  /api/jobsitepro →  http://127.0.0.1:8888"
echo "  jobsitepro.example.com  /ocr           →  http://127.0.0.1:8888"
echo ""
echo "  pocketbasechantier → 8091  (déjà bon)"
echo ""
log "Terminé. Test: curl -s https://jobsitepro.example.com/api/health"
