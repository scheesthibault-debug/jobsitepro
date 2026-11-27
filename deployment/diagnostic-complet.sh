#!/bin/bash
# JobsitePro — diagnostic connexion + OCR
# Usage: sudo bash deployment/diagnostic-complet.sh [email]

set -e
EMAIL="${1:-}"
LAN_IP="${LAN_IP:-127.0.0.1}"
DOMAIN="${DOMAIN:-jobsitepro.example.com}"

echo "=== JobsitePro diagnostic ==="
echo ""

echo "[1] Services"
systemctl is-active nginx chantiertrack chantiertrack-ocr 2>/dev/null || true
echo ""

echo "[2] Ports"
ss -tlnp | grep -E ':8090|:8888|:3101 ' || true
echo ""

echo "[3] Santé locale"
echo -n "  8090 PB:     "; curl -sf "http://127.0.0.1:8090/api/health" >/dev/null && echo OK || echo ECHEC
echo -n "  3101 OCR:    "; curl -sf "http://127.0.0.1:3101/health" >/dev/null && echo OK || echo ECHEC
echo -n "  8888 /ocr:   "; curl -sf "http://127.0.0.1:8888/ocr/health" >/dev/null && echo OK || echo ECHEC
echo -n "  8888 /api:   "; curl -sf "http://127.0.0.1:8888/api/health" >/dev/null && echo OK || echo ECHEC
echo ""

echo "[4] Domaine public (depuis le serveur)"
for path in /api/health /employe/ /ocr/health /push/health; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN$path" 2>/dev/null || echo "000")
  echo "  https://$DOMAIN$path → $code"
done
echo ""
if curl -sf "https://$DOMAIN/ocr/health" 2>/dev/null | grep -q gemini; then
  echo "  [OK] OCR public accessible — scan téléphone devrait marcher"
else
  echo "  [!] OCR public = 404 → NPM doit pointer vers port 8888 ou location /ocr/"
  echo "      Voir: deployment/NPM-FIX-URGENT.md"
fi
echo ""

echo "[5] Utilisateurs PocketBase (aperçu)"
curl -s "http://127.0.0.1:8090/api/collections/users/records?perPage=3" 2>/dev/null | head -c 400 || echo "  (admin requis pour lister)"
echo ""
echo ""

if [ -n "$EMAIL" ]; then
  echo "[6] Test auth (sans afficher le mot de passe)"
  echo "  Lancez manuellement:"
  echo "  curl -s -X POST http://127.0.0.1:8888/api/collections/users/auth-with-password \\"
  echo "    -H 'Content-Type: application/json' \\"
  echo "    -d '{\"identity\":\"$EMAIL\",\"password\":\"VOTRE_MOT_DE_PASSE\"}'"
fi

echo ""
echo "URLs employé:"
echo "  Local : http://$LAN_IP:8888/employe/"
echo "  Prod  : https://$DOMAIN/employe/"
