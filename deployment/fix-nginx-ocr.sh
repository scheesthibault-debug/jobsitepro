#!/bin/bash
# Ajoute / corrige le proxy Nginx /ocr/ → port 3101 (fix 502 sur :8888/ocr/)
# Usage: sudo bash deployment/fix-nginx-ocr.sh

set -e
NGINX_SITE="${NGINX_SITE:-/etc/nginx/sites-available/chantiertrack}"
ENABLED="${NGINX_ENABLED:-/etc/nginx/sites-enabled/chantiertrack}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

[ "$(id -u)" -eq 0 ] || { echo "sudo requis"; exit 1; }

echo "=== Fix Nginx /ocr/ (502 Bad Gateway) ==="

# Option A : config complète du projet
if [ -f "$SCRIPT_DIR/deployment/nginx-chantiertrack-complet.conf" ]; then
  echo "[1] Installation nginx-chantiertrack-complet.conf"
  cp -f "$SCRIPT_DIR/deployment/nginx-chantiertrack-complet.conf" "$NGINX_SITE"
  ln -sf "$NGINX_SITE" "$ENABLED"
else
  echo "[1] Fichier complet absent — patch du site existant"
  if [ ! -f "$NGINX_SITE" ]; then
    echo "ERREUR: $NGINX_SITE introuvable"
    exit 1
  fi
  if grep -q 'location /ocr/' "$NGINX_SITE"; then
    echo "    location /ocr/ déjà présente"
  else
    echo "    Ajout location /ocr/"
    TMP=$(mktemp)
    awk '
      /location \/push\// && !done {
        print "    location /ocr/ {"
        print "        proxy_pass http://127.0.0.1:3101/;"
        print "        proxy_set_header Host $host;"
        print "        proxy_set_header X-Real-IP $remote_addr;"
        print "        proxy_read_timeout 120s;"
        print "        proxy_connect_timeout 15s;"
        print "        client_max_body_size 20M;"
        print "    }"
        print ""
        done=1
      }
      { print }
    ' "$NGINX_SITE" > "$TMP"
    mv "$TMP" "$NGINX_SITE"
  fi
fi

echo "[2] Test config"
nginx -t

echo "[3] Reload nginx"
systemctl reload nginx

echo "[3b] Redémarrage OCR (évite 502 si le service a été interrompu)"
systemctl restart chantiertrack-ocr 2>/dev/null || true
sleep 2

echo "[4] Tests"
echo -n "  3101 direct: "
curl -sf "http://127.0.0.1:3101/health" >/dev/null && echo OK || echo ECHEC
echo -n "  8888 /ocr/:  "
curl -sf "http://127.0.0.1:8888/ocr/health" >/dev/null && echo OK || echo ECHEC

echo ""
curl -s "http://127.0.0.1:8888/ocr/health" 2>/dev/null || true
echo ""
echo "[✓] Si 8888 OK → scan employé peut utiliser /ocr/scan-receipt"
