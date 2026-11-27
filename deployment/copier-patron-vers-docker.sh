#!/bin/bash
# Copie patron/employé vers PocketBase Docker (8091) quand pb_data/pb_public n'existe pas sur l'hôte
# Usage: cd .../chantiertrack-v2 && sudo bash deployment/copier-patron-vers-docker.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"
SRC_PATRON="$SCRIPT_DIR/patron"
SRC_EMP="$SCRIPT_DIR/employe"
APP_DIR="${APP_DIR:-/opt/chantiertrack}"

echo "[1] Copie vers Nginx (toujours) → $APP_DIR/pb_public/"
mkdir -p "$APP_DIR/pb_public/patron" "$APP_DIR/pb_public/employe"
cp -f patron/index.html patron/sw.js patron/manifest.json "$APP_DIR/pb_public/patron/"
cp -rf patron/js patron/css "$APP_DIR/pb_public/patron/" 2>/dev/null || true
cp -f employe/index.html employe/sw.js employe/manifest.json "$APP_DIR/pb_public/employe/"
cp -rf employe/js employe/css "$APP_DIR/pb_public/employe/" 2>/dev/null || true

# Dossier classique PocketBase (si présent)
if [ -d "$APP_DIR/pb_data" ]; then
  mkdir -p "$APP_DIR/pb_data/pb_public/patron" "$APP_DIR/pb_data/pb_public/employe"
  cp -rf "$APP_DIR/pb_public/patron/"* "$APP_DIR/pb_data/pb_public/patron/"
  cp -rf "$APP_DIR/pb_public/employe/"* "$APP_DIR/pb_data/pb_public/employe/"
  echo "[2] Copie vers $APP_DIR/pb_data/pb_public/ OK"
else
  echo "[2] Pas de $APP_DIR/pb_data — PocketBase = Docker probable"
fi

echo "[3] Recherche conteneur PocketBase..."
CNAME=$(docker ps --format '{{.Names}}' 2>/dev/null | grep -iE 'pocket|chantier|pb' | head -1)
if [ -z "$CNAME" ]; then
  echo "    Aucun conteneur trouvé. Liste:"
  docker ps --format '  {{.Names}} → {{.Ports}}' 2>/dev/null || echo "    Docker non installé / pas de droits"
  echo ""
  echo "    SOLUTION NPM: pointer jobsitepro → port 8888 (Nginx sert pb_public/patron)"
  echo "    Ou copier à la main: docker cp patron/ NOM_CONTENEUR:/pb/pb_public/patron/"
  exit 0
fi

echo "    Conteneur: $CNAME"
# Chemins courants dans images PocketBase
for DEST in /pb/pb_public/patron /app/pb_public/patron /data/pb_public/patron; do
  if docker exec "$CNAME" test -d "$(dirname "$DEST")" 2>/dev/null; then
    docker exec "$CNAME" mkdir -p "$DEST" "$(dirname "$DEST")/../employe" 2>/dev/null || true
    docker cp "$SRC_PATRON/." "$CNAME:$DEST/"
    docker cp "$SRC_EMP/." "$CNAME:$(dirname "$DEST")/../employe/"
    echo "    Copié vers $CNAME:$DEST"
    if docker exec "$CNAME" grep -q nav_section_crm "$DEST/index.html" 2>/dev/null; then
      echo "    [OK] Menu CRM dans le conteneur"
    fi
    exit 0
  fi
done

echo "    Chemins standards introuvables — copie vers racine data du conteneur:"
docker cp "$SRC_PATRON" "$CNAME:/tmp/patron-upload"
echo "    Puis dans le conteneur, déplacez /tmp/patron-upload vers le pb_public de PocketBase"
echo "    Inspect: docker inspect $CNAME | grep -A5 Mounts"
