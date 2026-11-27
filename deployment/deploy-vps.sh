#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# ChantierTrack — Script de déploiement VPS production
# Testé sur Ubuntu 22.04 / 24.04 LTS
# ═══════════════════════════════════════════════════════════════
# Usage: sudo bash deploy.sh
# Variables à changer avant de lancer:

DOMAIN="chantiertrack.votre-domaine.com"   # ← TON DOMAINE PROFESSIONNEL
EMAIL="vous@votre-domaine.com"             # ← Pour le certificat SSL Let's Encrypt
PB_VERSION="0.22.4"                        # Version PocketBase
APP_DIR="/opt/chantiertrack"
PB_PORT="8090"

# ═══════════════════════════════════════════════════════════════
set -e
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

echo ""
echo "🏗️  ChantierTrack — Déploiement VPS"
echo "═══════════════════════════════════════"
echo "  Domaine : $DOMAIN"
echo "  Dossier  : $APP_DIR"
echo ""

# ─── 1. Mise à jour système ───────────────────────────────────
log "Mise à jour des paquets..."
apt-get update -qq && apt-get upgrade -y -qq

# ─── 2. Dépendances ──────────────────────────────────────────
log "Installation des dépendances..."
apt-get install -y -qq nginx certbot python3-certbot-nginx unzip curl ufw

# ─── 3. Firewall ─────────────────────────────────────────────
log "Configuration du firewall..."
ufw --force enable
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw reload

# ─── 4. Dossier application ───────────────────────────────────
log "Création du dossier $APP_DIR..."
mkdir -p $APP_DIR/pb_public/{patron,employe}
mkdir -p $APP_DIR/pb_data
mkdir -p $APP_DIR/backups
useradd -r -s /bin/false chantiertrack 2>/dev/null || true
chown -R chantiertrack:chantiertrack $APP_DIR

# ─── 5. PocketBase ───────────────────────────────────────────
log "Téléchargement de PocketBase v$PB_VERSION..."
PB_URL="https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip"
curl -L -o /tmp/pb.zip "$PB_URL" --progress-bar
unzip -o /tmp/pb.zip pocketbase -d $APP_DIR/
chmod +x $APP_DIR/pocketbase
rm /tmp/pb.zip
log "PocketBase installé: $($APP_DIR/pocketbase --version)"

# ─── 6. Copie des fichiers app ───────────────────────────────
log "Copie des fichiers ChantierTrack..."
if [ -d "./patron" ]; then
  cp -r ./patron/index.html $APP_DIR/pb_public/patron/
  cp -r ./patron/manifest.json $APP_DIR/pb_public/patron/ 2>/dev/null || true
  cp -r ./patron/sw.js $APP_DIR/pb_public/patron/ 2>/dev/null || true
  cp -r ./patron/icon-*.png $APP_DIR/pb_public/patron/ 2>/dev/null || true
  cp -r ./patron/logo-banner.png $APP_DIR/pb_public/patron/ 2>/dev/null || true
  cp -r ./patron/apple-touch-icon.png $APP_DIR/pb_public/patron/ 2>/dev/null || true
  cp -r ./patron/js $APP_DIR/pb_public/patron/ 2>/dev/null || true
  log "Dashboard patron copié"
else
  warn "Dossier ./patron non trouvé — copiez patron/index.html manuellement dans $APP_DIR/pb_public/patron/"
fi

if [ -d "./employe" ]; then
  cp -r ./employe/index.html $APP_DIR/pb_public/employe/
  cp -r ./employe/manifest.json $APP_DIR/pb_public/employe/
  cp -r ./employe/sw.js $APP_DIR/pb_public/employe/
  cp -r ./employe/icon-*.png $APP_DIR/pb_public/employe/ 2>/dev/null || true
  cp -r ./employe/apple-touch-icon.png $APP_DIR/pb_public/employe/ 2>/dev/null || true
  log "App employé copiée"
else
  warn "Dossier ./employe non trouvé — copiez les fichiers manuellement dans $APP_DIR/pb_public/employe/"
fi

if [ -d "./site" ]; then
  cp -r ./site/index.html $APP_DIR/pb_public/
  cp -r ./site/presentation.html $APP_DIR/pb_public/
  log "Site marketing copié"
fi

if [ -d "./push" ]; then
  mkdir -p $APP_DIR/push
  cp -r ./push/package.json ./push/server.js ./push/generate-vapid.js $APP_DIR/push/ 2>/dev/null || true
  if command -v npm >/dev/null 2>&1; then
    (cd $APP_DIR/push && npm install --omit=dev -qq) || warn "npm install push échoué — faire manuellement"
  fi
  if [ -f "./deployment/chantiertrack-push.service" ]; then
    cp ./deployment/chantiertrack-push.service /etc/systemd/system/
    systemctl daemon-reload
    systemctl enable chantiertrack-push 2>/dev/null || true
    warn "Push: exécutez « cd $APP_DIR/push && npm run vapid » puis ajoutez adminToken dans vapid.json"
  fi
  log "Dossier push copié (configurer vapid.json)"
fi

# ─── 7. Service systemd ───────────────────────────────────────
log "Création du service systemd..."
cat > /etc/systemd/system/chantiertrack.service << EOF
[Unit]
Description=ChantierTrack PocketBase Server
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=chantiertrack
Group=chantiertrack
WorkingDirectory=$APP_DIR
ExecStart=$APP_DIR/pocketbase serve --http="127.0.0.1:$PB_PORT" --dir="$APP_DIR/pb_data"
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=chantiertrack

# Sécurité
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=$APP_DIR/pb_data $APP_DIR/backups

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable chantiertrack
systemctl start chantiertrack
sleep 2

if systemctl is-active --quiet chantiertrack; then
  log "Service chantiertrack démarré avec succès"
else
  err "Le service n'a pas démarré. Vérifiez: journalctl -u chantiertrack -n 20"
fi

# ─── 8. Nginx reverse proxy ───────────────────────────────────
log "Configuration Nginx..."
cat > /etc/nginx/sites-available/chantiertrack << EOF
server {
    listen 80;
    server_name $DOMAIN;

    # Redirection patron/ → index de PocketBase
    location / {
        proxy_pass http://127.0.0.1:$PB_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # WebSocket (PocketBase realtime)
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";

        # Timeouts
        proxy_connect_timeout  60s;
        proxy_send_timeout    300s;
        proxy_read_timeout    300s;
    }

    # Web Push (notifications PWA fermée)
    location /push/ {
        proxy_pass http://127.0.0.1:3099/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Uploads max 50MB (photos chantier)
    client_max_body_size 50M;

    # Compression
    gzip on;
    gzip_types text/html text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1000;
}
EOF

ln -sf /etc/nginx/sites-available/chantiertrack /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
log "Nginx configuré"

# ─── 9. SSL Let's Encrypt ─────────────────────────────────────
log "Obtention du certificat SSL pour $DOMAIN..."
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "$EMAIL" --redirect
log "SSL configuré — HTTPS actif"

# ─── 10. Cron backup quotidien ────────────────────────────────
log "Configuration des sauvegardes automatiques..."
cat > /etc/cron.d/chantiertrack-backup << EOF
# Backup ChantierTrack — tous les jours à 2h du matin
0 2 * * * chantiertrack tar -czf $APP_DIR/backups/pb_data_\$(date +\%Y\%m\%d).tar.gz -C $APP_DIR pb_data/ 2>/dev/null
# Garder seulement les 30 derniers jours
5 2 * * * chantiertrack find $APP_DIR/backups/ -name "pb_data_*.tar.gz" -mtime +30 -delete 2>/dev/null
EOF
log "Backups quotidiens configurés (conservés 30 jours)"

# ─── 11. Script de mise à jour ────────────────────────────────
cat > /usr/local/bin/chantiertrack-update << 'UPDATEEOF'
#!/bin/bash
# Usage: sudo chantiertrack-update [version]
VERSION=${1:-"latest"}
APP_DIR="/opt/chantiertrack"
echo "Arrêt du service..."
systemctl stop chantiertrack
echo "Backup avant mise à jour..."
tar -czf $APP_DIR/backups/pre-update-$(date +%Y%m%d%H%M).tar.gz -C $APP_DIR pb_data/
echo "Téléchargement PocketBase $VERSION..."
if [ "$VERSION" = "latest" ]; then
  LATEST=$(curl -s https://api.github.com/repos/pocketbase/pocketbase/releases/latest | grep '"tag_name"' | cut -d'"' -f4 | sed 's/v//')
  VERSION=$LATEST
fi
curl -L -o /tmp/pb.zip "https://github.com/pocketbase/pocketbase/releases/download/v${VERSION}/pocketbase_${VERSION}_linux_amd64.zip"
unzip -o /tmp/pb.zip pocketbase -d $APP_DIR/
chmod +x $APP_DIR/pocketbase
rm /tmp/pb.zip
systemctl start chantiertrack
echo "✓ Mis à jour vers v$VERSION"
UPDATEEOF
chmod +x /usr/local/bin/chantiertrack-update

# ─── RÉSUMÉ ───────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "🎉 ChantierTrack déployé avec succès!"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "  🌐 URL principale  : https://$DOMAIN"
echo "  👔 Dashboard patron : https://$DOMAIN/patron/"
echo "  👷 App employé      : https://$DOMAIN/employe/"
echo "  🌍 Site marketing   : https://$DOMAIN/"
echo "  🔧 Admin PocketBase : https://$DOMAIN/_/"
echo ""
echo "  📂 Dossier app   : $APP_DIR"
echo "  📊 Logs          : journalctl -u chantiertrack -f"
echo "  🔄 Mise à jour   : sudo chantiertrack-update"
echo "  💾 Backups       : $APP_DIR/backups/"
echo ""
echo "  ⚠️  Prochaine étape:"
echo "     1. Ouvrir https://$DOMAIN/_ et créer le compte admin"
echo "     2. Settings → Import collections → coller collections.json"
echo "     3. Créer la première entreprise + compte patron"
echo ""
echo "  📌 Pour migrer depuis ton NUC:"
echo "     Sur NUC     : tar -czf backup.tar.gz pb_data/"
echo "     Transférer  : scp backup.tar.gz root@IP_VPS:$APP_DIR/"
echo "     Sur VPS     : tar -xzf backup.tar.gz -C $APP_DIR/"
echo "     Redémarrer  : systemctl restart chantiertrack"
echo ""
