#!/bin/bash
# Mise à jour JobsitePro SANS effacer PocketBase (données conservées)
# Usage: cd ~/chantiertrack-v2 && sudo bash deployment/mise-a-jour-jobsitepro.sh

set -e
APP_DIR="${APP_DIR:-/opt/chantiertrack}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

copy_front() {
  local dest="$1"
  mkdir -p "$dest/patron" "$dest/employe"
  cp -f patron/index.html patron/sw.js patron/manifest.json "$dest/patron/" 2>/dev/null || true
  cp -rf patron/js patron/css "$dest/patron/" 2>/dev/null || true
  cp -f patron/icon-*.png patron/apple-touch-icon.png patron/logo-banner.png "$dest/patron/" 2>/dev/null || true
  cp -f employe/index.html employe/sw.js employe/manifest.json "$dest/employe/" 2>/dev/null || true
  cp -rf employe/js employe/css "$dest/employe/" 2>/dev/null || true
  cp -f employe/icon-*.png employe/apple-touch-icon.png "$dest/employe/" 2>/dev/null || true
}

echo "[1/5] Copie patron + employé (2 emplacements)"
echo "    → $APP_DIR/pb_public/     (Nginx :8888)"
copy_front "$APP_DIR/pb_public"
echo "    → $APP_DIR/pb_data/pb_public/  (PocketBase :8091 — jobsitepro NPM)"
copy_front "$APP_DIR/pb_data/pb_public"
chown -R chantiertrack:chantiertrack "$APP_DIR/pb_public" "$APP_DIR/pb_data/pb_public" 2>/dev/null || true
if grep -q 'nav_section_crm' "$APP_DIR/pb_data/pb_public/patron/index.html" 2>/dev/null; then
  echo "    OK front (menu CRM présent sur 8091)"
else
  echo "    ATTENTION: index patron sur 8091 sans menu CRM — vérifiez la copie"
fi

echo "[2/5] Service OCR reçus..."
if [ -f "$SCRIPT_DIR/deployment/install-receipt-ocr.sh" ]; then
  bash "$SCRIPT_DIR/deployment/install-receipt-ocr.sh"
else
  echo "    install-receipt-ocr.sh introuvable"
fi

echo "[3/5] Push (si présent)..."
if [ -d "$SCRIPT_DIR/push" ] && [ -d "$APP_DIR/push" ]; then
  cp -f "$SCRIPT_DIR/push/server.js" "$SCRIPT_DIR/push/package.json" "$APP_DIR/push/" 2>/dev/null || true
  (cd "$APP_DIR/push" && sudo -u chantiertrack npm install --omit=dev 2>/dev/null) || true
  systemctl restart chantiertrack-push 2>/dev/null || true
fi

echo "[4/5] Redémarrage PocketBase..."
systemctl restart chantiertrack 2>/dev/null || true

echo "[5/5] Vérifications..."
curl -sf "http://127.0.0.1:3101/health" && echo "" || echo "    OCR: pas encore OK — configurez la clé Gemini"
curl -sf "http://127.0.0.1/push/health" && echo "" || echo "    Push: optionnel"
echo ""
echo "════════════════════════════════════════════"
echo "  Prochaine étape OBLIGATOIRE si pas fait :"
echo "  sudo bash deployment/configure-gemini-ocr.sh"
echo "  Puis champs PocketBase — voir GUIDE_INSTALLATION_SERVEUR.md"
echo "════════════════════════════════════════════"
