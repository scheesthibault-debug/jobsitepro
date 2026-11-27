#!/bin/bash
# Login local — pointer Nginx 8888 vers PocketBase 8091 (vraie base JobsitePro)
# Usage: sudo bash deployment/fix-login-local-8091.sh

set -e
NGINX_SITE="${NGINX_SITE:-/etc/nginx/sites-available/chantiertrack}"
EMAIL="${1:-you@example.com}"

[ "$(id -u)" -eq 0 ] || { echo "sudo requis"; exit 1; }
[ -f "$NGINX_SITE" ] || { echo "Nginx chantiertrack introuvable"; exit 1; }

echo "=== Fix login : API 8888 → PocketBase 8091 ==="

cp -a "$NGINX_SITE" "${NGINX_SITE}.bak.$(date +%Y%m%d_%H%M%S)"

# Remplacer proxy PocketBase 8090 → 8091 (pas le port OCR 3101)
sed -i 's|proxy_pass http://127.0.0.1:8090;|proxy_pass http://127.0.0.1:8091;|g' "$NGINX_SITE"

nginx -t
systemctl reload nginx

echo ""
echo "--- Santé ---"
curl -sf http://127.0.0.1:8091/api/health && echo " (8091 OK)" || echo "8091 ECHEC"
curl -sf http://127.0.0.1:8888/api/health && echo " (8888→8091 OK)" || echo "8888 ECHEC"
curl -sf http://127.0.0.1:8888/api/jobsitepro/ocr-health | head -c 120
echo ""

echo ""
echo "--- Test login (sans afficher le mot de passe) ---"
echo "8091 direct:"
curl -s -X POST "http://127.0.0.1:8091/api/collections/users/auth-with-password" \
  -H 'Content-Type: application/json' \
  -d "{\"identity\":\"$EMAIL\",\"password\":\"REMPLACER_MDP\"}" | head -c 150
echo ""
echo "8888 via nginx:"
curl -s -X POST "http://127.0.0.1:8888/api/collections/users/auth-with-password" \
  -H 'Content-Type: application/json' \
  -d "{\"identity\":\"$EMAIL\",\"password\":\"REMPLACER_MDP\"}" | head -c 150
echo ""
echo ""
echo "Remplacez REMPLACER_MDP dans la commande ci-dessus pour tester."
echo "App employé local: http://127.0.0.1:8888/employe/"
echo "Admin PB:          http://127.0.0.1:8091/_/"
