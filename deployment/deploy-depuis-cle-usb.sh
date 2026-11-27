#!/bin/bash
# JobsitePro — Déploie depuis la clé USB (source officielle)
# Usage: cd /mnt/stockage/chantiertrack-v2/chantiertrack-v2 && sudo bash deployment/deploy-depuis-cle-usb.sh

set -e
USB_ROOT="${USB_ROOT:-/mnt/stockage/chantiertrack-v2/chantiertrack-v2}"
APP_DIR="${APP_DIR:-/opt/chantiertrack}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

[ "$(id -u)" -eq 0 ] || err "Lancez avec sudo"

if [ ! -d "$USB_ROOT/patron" ]; then
  err "patron/ introuvable sur la clé: $USB_ROOT/patron — copiez le projet depuis le PC."
fi

log "Source (clé USB): $USB_ROOT"
log "Cible app:        $APP_DIR/pb_public/"

mkdir -p "$APP_DIR/pb_public/patron" "$APP_DIR/pb_public/employe"

# Patron
cp -f "$USB_ROOT/patron/index.html" "$USB_ROOT/patron/sw.js" "$USB_ROOT/patron/manifest.json" \
  "$APP_DIR/pb_public/patron/" 2>/dev/null || true
cp -f "$USB_ROOT/patron/icon-"*.png "$USB_ROOT/patron/apple-touch-icon.png" "$USB_ROOT/patron/logo-banner.png" \
  "$APP_DIR/pb_public/patron/" 2>/dev/null || true
[ -d "$USB_ROOT/patron/js" ]  && cp -rf "$USB_ROOT/patron/js"  "$APP_DIR/pb_public/patron/"
[ -d "$USB_ROOT/patron/css" ] && cp -rf "$USB_ROOT/patron/css" "$APP_DIR/pb_public/patron/"

# Employé
cp -f "$USB_ROOT/employe/index.html" "$USB_ROOT/employe/sw.js" "$USB_ROOT/employe/manifest.json" \
  "$APP_DIR/pb_public/employe/" 2>/dev/null || true
cp -f "$USB_ROOT/employe/icon-"*.png "$USB_ROOT/employe/apple-touch-icon.png" \
  "$APP_DIR/pb_public/employe/" 2>/dev/null || true
[ -d "$USB_ROOT/employe/js" ]  && cp -rf "$USB_ROOT/employe/js"  "$APP_DIR/pb_public/employe/"
[ -d "$USB_ROOT/employe/css" ] && cp -rf "$USB_ROOT/employe/css" "$APP_DIR/pb_public/employe/"

# Même copie pour PocketBase :8091 (jobsitepro NPM → souvent ce dossier)
mkdir -p "$APP_DIR/pb_data/pb_public/patron" "$APP_DIR/pb_data/pb_public/employe"
cp -rf "$APP_DIR/pb_public/patron/"* "$APP_DIR/pb_data/pb_public/patron/" 2>/dev/null || true
cp -rf "$APP_DIR/pb_public/employe/"* "$APP_DIR/pb_data/pb_public/employe/" 2>/dev/null || true
log "Copie aussi vers $APP_DIR/pb_data/pb_public/ (PocketBase 8091)"

# Services OCR (optionnel)
if [ -d "$USB_ROOT/services/receipt-ocr" ]; then
  mkdir -p "$APP_DIR/receipt-ocr"
  for f in server.js parse-receipt-text.js package.json .env.example; do
    if [ -f "$USB_ROOT/services/receipt-ocr/$f" ]; then
      cp -f "$USB_ROOT/services/receipt-ocr/$f" "$APP_DIR/receipt-ocr/"
    else
      warn "Manquant sur clé USB: services/receipt-ocr/$f — copiez depuis le PC"
    fi
  done
  [ -f "$APP_DIR/receipt-ocr/package.json" ] && (cd "$APP_DIR/receipt-ocr" && npm install --omit=dev 2>/dev/null) || true
fi

id chantiertrack &>/dev/null || useradd -r -s /bin/false chantiertrack
chown -R chantiertrack:chantiertrack "$APP_DIR/pb_public" "$APP_DIR/receipt-ocr" 2>/dev/null || true

# Nginx config complète (8888) si présente sur la clé
if [ -f "$USB_ROOT/deployment/nginx-chantiertrack-complet.conf" ]; then
  cp -f "$USB_ROOT/deployment/nginx-chantiertrack-complet.conf" /etc/nginx/sites-available/chantiertrack
  ln -sf /etc/nginx/sites-available/chantiertrack /etc/nginx/sites-enabled/chantiertrack
  rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
  nginx -t && systemctl reload nginx 2>/dev/null || warn "Nginx reload — démarrez: sudo systemctl start nginx"
fi

systemctl restart chantiertrack 2>/dev/null || warn "PocketBase: sudo systemctl restart chantiertrack"
systemctl restart chantiertrack-ocr 2>/dev/null || true

# Hook PocketBase : scan OCR via /api/jobsitepro/ (contourne NPM /ocr/ 404)
if [ -d "$USB_ROOT/pocketbase/pb_hooks" ]; then
  mkdir -p "$APP_DIR/pb_hooks" "$APP_DIR/pb_data/pb_hooks"
  cp -f "$USB_ROOT/pocketbase/pb_hooks/"*.pb.js "$APP_DIR/pb_hooks/" 2>/dev/null || true
  cp -f "$USB_ROOT/pocketbase/pb_hooks/"*.pb.js "$APP_DIR/pb_data/pb_hooks/" 2>/dev/null || true
  chown -R chantiertrack:chantiertrack "$APP_DIR/pb_hooks" "$APP_DIR/pb_data/pb_hooks" 2>/dev/null || true
  log "Hooks PocketBase copiés → $APP_DIR/pb_data/pb_hooks/"
  systemctl restart chantiertrack 2>/dev/null || true
fi

echo ""
log "Déploiement terminé"
echo ""
echo "  Fichiers patron : $(ls "$APP_DIR/pb_public/patron" | tr '\n' ' ')"
echo ""
echo "  Test: curl -I http://127.0.0.1:8888/patron/  (ou :8090/patron/index.html)"
echo "  URL API app: http://127.0.0.1:8888  (ou :8090 si pas Nginx)"
echo ""
warn "Doublon home supprimable: rm -rf ~/chantiertrack-v2"
warn "Ne pas supprimer: $APP_DIR/pb_data (base de données)"
