#!/bin/bash
# Vérifie que la clé USB / dossier source contient les fichiers scan récents
# Usage: bash deployment/verifier-cle-usb.sh

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok=0; miss=0

check() {
  if [ -f "$ROOT/$1" ] || [ -d "$ROOT/$1" ]; then
    echo -e "${GREEN}[OK]${NC} $1"
    ok=$((ok + 1))
  else
    echo -e "${RED}[MANQUANT]${NC} $1"
    miss=$((miss + 1))
  fi
}

echo "=== Vérification source: $ROOT ==="
echo ""
echo "Scan JobsitePro (Gemini — app employé actuelle):"
check "deployment/install-scan-gemini-now.sh"
check "deployment/deploy-depuis-cle-usb.sh"
check "deployment/configure-gemini-ocr.sh"
check "services/receipt-ocr/server.js"
check "employe/js/expense-receipt-scan.js"
check "pocketbase/pb_hooks/receipt_ocr_proxy.pb.js"
echo ""
echo "Intégrations QuickBooks:"
check "services/integrations-hub/package.json"
check "deployment/install-integrations-hub.sh"
echo ""
if [ "$miss" -eq 0 ]; then
  echo -e "${GREEN}Tout est présent.${NC} JobsitePro scan:"
  echo "  sudo bash deployment/deploy-depuis-cle-usb.sh"
  echo "  sudo bash deployment/install-scan-gemini-now.sh \"VOTRE_CLE_GEMINI\""
else
  echo -e "${YELLOW}$miss fichier(s) manquant(s).${NC}"
  echo "Sur le PC Windows, depuis chantiertrack-v2\\chantiertrack-v2 :"
  echo "  .\\deployment\\COPIER_VERS_CLE_USB.ps1 -Server user@127.0.0.1"
  exit 1
fi
