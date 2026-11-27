#!/bin/bash
# PocketBase refuse auth ("Use HTTPS") si le proxy n'envoie pas X-Forwarded-Proto: https
# Usage: sudo bash deployment/fix-pb-https-headers.sh

set -euo pipefail

NGINX_SITE="${NGINX_SITE:-/etc/nginx/sites-available/chantiertrack}"

if [[ ! -f "$NGINX_SITE" ]]; then
  echo "Fichier introuvable: $NGINX_SITE"
  exit 1
fi

cp -a "$NGINX_SITE" "${NGINX_SITE}.bak.$(date +%Y%m%d%H%M%S)"

# Remplacer $scheme par https pour les blocs proxy PocketBase (8091)
sed -i 's|proxy_set_header X-Forwarded-Proto \$scheme;|proxy_set_header X-Forwarded-Proto https;|g' "$NGINX_SITE"

# Ajouter X-Forwarded-Proto sur /_/ et /api/files/ s'ils proxy vers 8091 sans header
python3 - <<'PY' "$NGINX_SITE"
import re, sys
path = sys.argv[1]
text = open(path, encoding='utf-8').read()
header = "        proxy_set_header X-Forwarded-Proto https;\n"
for block in ('location /_/ {', 'location /api/files/ {'):
    if block not in text:
        continue
    pattern = re.compile(
        r'(location /(?:_|api/files)/ \{[^}]*?proxy_pass http://127\.0\.0\.1:8091;\n)'
        r'((?:(?!X-Forwarded-Proto).)*?\n    \})',
        re.S,
    )
    def repl(m):
        body = m.group(2)
        if 'X-Forwarded-Proto' in body:
            return m.group(0)
        return m.group(1) + header + body
    text = pattern.sub(repl, text)
open(path, 'w', encoding='utf-8').write(text)
PY

nginx -t
systemctl reload nginx

echo ""
echo "=== Test API via 8888 ==="
curl -sf http://127.0.0.1:8888/api/health && echo "" || echo "ECHEC 8888"
echo ""
echo "=== NPM : ajoute aussi dans le Proxy Host jobsitepro (Advanced) ==="
cat <<'EOF'
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header Host $host;
EOF
