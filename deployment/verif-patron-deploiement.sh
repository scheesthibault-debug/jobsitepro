#!/bin/bash
# Vérifie que jobsitepro sert la bonne version du patron (menu CRM & Ops)
# Usage: sudo bash deployment/verif-patron-deploiement.sh

APP_DIR="${APP_DIR:-/opt/chantiertrack}"
MARKER='nav_section_crm'

check_file() {
  local label="$1"
  local path="$2"
  if [ ! -f "$path" ]; then
    echo "  [—] $label : fichier absent ($path)"
    return 1
  fi
  if grep -q "$MARKER" "$path"; then
    echo "  [OK] $label : menu CRM présent"
    return 0
  fi
  echo "  [!!] $label : ANCIENNE VERSION (pas de CRM)"
  return 1
}

echo "=== Vérification déploiement patron ==="
echo ""
check_file "Nginx 8888" "$APP_DIR/pb_public/patron/index.html"
if [ -f "$APP_DIR/pb_data/pb_public/patron/index.html" ]; then
  check_file "PocketBase hôte pb_data" "$APP_DIR/pb_data/pb_public/patron/index.html"
else
  echo "  [—] PocketBase hôte: pas de $APP_DIR/pb_data/pb_public/ (souvent Docker 8091)"
fi
check_file "Stockage (dev)" "/mnt/stockage/chantiertrack-v2/chantiertrack-v2/patron/index.html" 2>/dev/null || true

echo ""
echo "Si pb_data absent → sudo bash deployment/copier-patron-vers-docker.sh"
echo "Ou NPM: jobsitepro * → port 8888 (Nginx sert pb_public)"
echo "  → Relancer: sudo bash deployment/mise-a-jour-jobsitepro.sh"
echo ""
echo "Test HTTPS (depuis le serveur):"
curl -sf "https://jobsitepro.example.com/patron/index.html" 2>/dev/null | grep -q "$MARKER" \
  && echo "  [OK] Site public contient CRM" \
  || echo "  [!!] Site public = ancienne version OU cache navigateur"
