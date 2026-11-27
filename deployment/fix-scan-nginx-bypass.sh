#!/bin/bash
# Contourne PocketBase : Nginx envoie /api/jobsitepro/* → OCR Gemini (3101)
# Usage: cd .../chantiertrack-v2 && sudo bash deployment/fix-scan-nginx-bypass.sh

set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NGINX_SITE="${NGINX_SITE:-/etc/nginx/sites-available/chantiertrack}"

[ "$(id -u)" -eq 0 ] || { echo "sudo requis"; exit 1; }

if [ -f "$ROOT/deployment/nginx-chantiertrack-complet.conf" ]; then
  cp -f "$ROOT/deployment/nginx-chantiertrack-complet.conf" "$NGINX_SITE"
  ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/chantiertrack 2>/dev/null || true
  echo "[OK] nginx-chantiertrack-complet.conf installé"
else
  echo "Fichier nginx manquant sur la clé USB"
  exit 1
fi

nginx -t
systemctl reload nginx

echo ""
echo "=== Tests scan (Nginx 8888 → OCR 3101) ==="
echo -n "OCR 3101:              "
curl -sf http://127.0.0.1:3101/health | grep -q gemini && echo OK || echo ECHEC
echo -n "8888 jobsitepro health:"
curl -sf http://127.0.0.1:8888/api/jobsitepro/ocr-health | head -c 100
echo ""
echo ""
echo "Si Public HTTPS échoue encore → NPM doit pointer vers port 8888"
echo "  curl -s https://jobsitepro.example.com/api/jobsitepro/ocr-health"
