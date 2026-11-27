#!/bin/bash
# Où est le vrai index.html patron servi par jobsitepro ?
# Usage: bash deployment/trouver-patron-sur-serveur.sh

MARKER='nav_section_crm'

echo "=== 1) Fichiers patron/index.html sur le disque ==="
for f in \
  /opt/chantiertrack/pb_public/patron/index.html \
  /opt/chantiertrack/pb_data/pb_public/patron/index.html \
  /mnt/stockage/chantiertrack-v2/chantiertrack-v2/patron/index.html \
  ~/chantiertrack-v2/chantiertrack-v2/patron/index.html \
  ~/chantiertrack-v2/patron/index.html; do
  if [ -f "$f" ]; then
    if grep -q "$MARKER" "$f" 2>/dev/null; then
      echo "  [OK CRM]  $f"
    else
      echo "  [ancien]  $f"
    fi
  fi
done

echo ""
echo "=== 2) Recherche large (peut prendre 20 s) ==="
sudo find /opt /mnt/stockage /home -path '*/patron/index.html' 2>/dev/null | head -20

echo ""
echo "=== 3) PocketBase / Docker (port 8091) ==="
if curl -sf http://127.0.0.1:8091/api/health >/dev/null; then
  echo "  API 8091: OK"
else
  echo "  API 8091: ne répond pas"
fi
docker ps --format '{{.Names}} {{.Ports}}' 2>/dev/null | grep -E '8091|pocket|NAME' || echo "  (pas de docker ou pas 8091)"

echo ""
echo "=== 4) Ce que le site renvoie (HTML public) ==="
HTML=$(curl -sf "http://127.0.0.1:8091/patron/index.html" 2>/dev/null | head -c 50000)
if [ -z "$HTML" ]; then
  HTML=$(curl -sf "http://127.0.0.1:8888/patron/index.html" 2>/dev/null | head -c 50000)
  echo "  Test via 8888"
fi
if echo "$HTML" | grep -q "$MARKER"; then
  echo "  [OK] HTML servi contient menu CRM"
else
  echo "  [!!] HTML servi = ANCIENNE version (pas de CRM)"
fi

echo ""
echo "=== 5) Nginx ==="
grep -r "patron" /etc/nginx/sites-enabled/ 2>/dev/null | head -8 || true

echo ""
echo "Copie recommandée après sync:"
echo "  cd /mnt/stockage/chantiertrack-v2/chantiertrack-v2"
echo "  sudo bash deployment/mise-a-jour-jobsitepro.sh"
echo "  sudo bash deployment/copier-patron-vers-docker.sh   # si PocketBase = Docker"
