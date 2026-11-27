#!/bin/bash
# JobsitePro — Active le scan IA de reçus (OCR) de A à Z
# Usage sur le serveur (clé USB montée):
#   cd /mnt/stockage/chantiertrack-v2/chantiertrack-v2
#   sudo bash deployment/activer-scan-complet.sh
#
# Avec clé Gemini (recommandé):
#   sudo bash deployment/activer-scan-complet.sh "AIzaSy..."

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
USB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_DIR="${APP_DIR:-/opt/chantiertrack}"
GEMINI_KEY="${1:-}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn(){ echo -e "${YELLOW}[!]${NC} $1"; }
err() { echo -e "${RED}[✗]${NC} $1"; exit 1; }
step(){ echo -e "\n${CYAN}=== $1 ===${NC}"; }

[ "$(id -u)" -eq 0 ] || err "Lancez avec sudo"

step "1/6 — Déploiement apps (patron + employé + OCR)"
if [ -f "$SCRIPT_DIR/deploy-depuis-cle-usb.sh" ]; then
  USB_ROOT="$USB_ROOT" APP_DIR="$APP_DIR" bash "$SCRIPT_DIR/deploy-depuis-cle-usb.sh"
else
  warn "deploy-depuis-cle-usb.sh absent — copiez deployment/ depuis le PC"
fi

step "2/6 — Installation service OCR"
bash "$SCRIPT_DIR/install-receipt-ocr.sh"

step "3/6 — Fichiers OCR (syntaxe + npm)"
bash "$SCRIPT_DIR/fix-ocr-502.sh" || warn "fix-ocr-502 a signalé un problème"

step "4/6 — Clé API Gemini (IA)"
if [ -n "$GEMINI_KEY" ]; then
  bash "$SCRIPT_DIR/configure-gemini-ocr.sh" "$GEMINI_KEY"
else
  if [ -f "$APP_DIR/receipt-ocr/.env" ] && grep -qE 'GOOGLE_AI_API_KEY=(AIza|AQ\.)' "$APP_DIR/receipt-ocr/.env" 2>/dev/null; then
    ok "Clé Gemini déjà dans .env"
    systemctl restart chantiertrack-ocr
  else
    warn "Pas de clé Gemini — le scan IA ne marchera pas sans elle"
    echo ""
    echo "  Créez une clé GRATUITE: https://aistudio.google.com/apikey (AIza… ou AQ.…)"
    echo "  Puis:"
    echo "    sudo bash deployment/configure-gemini-ocr.sh \"AQ....\""
    echo ""
    read -r -p "Coller la clé maintenant (Entrée = passer): " GEMINI_KEY
    if [ -n "$GEMINI_KEY" ]; then
      bash "$SCRIPT_DIR/configure-gemini-ocr.sh" "$GEMINI_KEY"
    fi
  fi
fi

step "5/6 — Nginx /ocr/ (local)"
if [ -f "$SCRIPT_DIR/fix-nginx-ocr.sh" ]; then
  bash "$SCRIPT_DIR/fix-nginx-ocr.sh" 2>/dev/null || true
fi

# Nginx reload peut coïncider avec un redémarrage OCR — on stabilise avant les tests finaux
systemctl restart chantiertrack-ocr 2>/dev/null || true
sleep 2
bash "$SCRIPT_DIR/fix-ocr-502.sh" 2>/dev/null || true

step "6/6 — Tests"
echo ""
HEALTH=$(curl -sf "http://127.0.0.1:3101/health" 2>/dev/null || echo '{}')
echo "Port 3101: $HEALTH"
echo ""

if echo "$HEALTH" | grep -q '"gemini":true'; then
  ok "Gemini configuré"
else
  warn "gemini:false — ajoutez GOOGLE_AI_API_KEY (AIza…)"
fi

if curl -sf "http://127.0.0.1:8888/ocr/health" >/dev/null 2>&1; then
  ok "Nginx 8888/ocr/health OK"
  curl -s "http://127.0.0.1:8888/ocr/health"
  echo ""
else
  warn "8888/ocr/health échoue — vérifiez Nginx (nginx-chantiertrack-complet.conf)"
fi

echo ""
echo -e "${GREEN}════════════════════════════════════════════════════${NC}"
echo "  Scan côté téléphone: https://jobsitepro.example.com/employe/"
echo ""
echo "  NPM (obligatoire en prod): Custom location /ocr/ → http://IP:8888/ocr/"
echo "  Test: curl -s https://jobsitepro.example.com/ocr/health"
echo ""
echo "  Test scan serveur: sudo bash deployment/test-ocr-scan.sh"
echo -e "${GREEN}════════════════════════════════════════════════════${NC}"
