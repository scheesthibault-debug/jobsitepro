#!/usr/bin/env bash
# JobsitePro — contact Resend (même config que example.com)
# Usage: bash deployment/fix-jobsitepro-contact-resend.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/services/contact-mail/.env"

echo "=== JobsitePro contact-mail — Resend (comme example.com) ==="
echo ""
echo "Utilise la clé API du compte Resend où example.com est Verified."
echo "(Cloudflare Worker → Settings → RESEND_API_KEY, ou Resend → API Keys)"
echo ""

read -r -p "Collez la clé re_... : " RESEND_KEY
if [[ -z "$RESEND_KEY" || "$RESEND_KEY" != re_* ]]; then
  echo "ERREUR: clé invalide (doit commencer par re_)"
  exit 1
fi

mkdir -p "$(dirname "$ENV_FILE")"
cat > "$ENV_FILE" << EOF
PORT=3103
CONTACT_BIND=127.0.0.1

CONTACT_TO=contact@example.com
CONTACT_FROM=noreply@example.com
CONTACT_FROM_NAME=JobsitePro

CONTACT_SITE_URL=https://jobsitepro.example.com
CONTACT_SITE_LABEL=jobsitepro.example.com

MAIL_PROVIDER=resend
RESEND_API_KEY=${RESEND_KEY}

CORS_ORIGINS=https://jobsitepro.example.com,http://127.0.0.1:8888,http://127.0.0.1:8888
EOF

echo ""
echo "Config écrite. Redémarrage..."
bash "$ROOT/deployment/install-contact-mail-user.sh"

echo ""
echo "=== Test envoi ==="
RESULT=$(curl -s -X POST "http://127.0.0.1:3103/api/send" \
  -H "Content-Type: application/json" \
  -H "Origin: https://jobsitepro.example.com" \
  -d '{"name":"Test JobsitePro","email":"test@example.com","message":"Test depuis fix-jobsitepro-contact-resend.sh"}')
echo "$RESULT"

if echo "$RESULT" | grep -q '"ok":true'; then
  echo ""
  echo "✅ OK — reteste le formulaire sur:"
  echo "   https://jobsitepro.example.com/site/contact.html"
else
  echo ""
  echo "❌ Échec — mauvaise clé ou mauvais compte Resend."
  echo "   La clé DOIT venir du compte où example.com est Verified."
  tail -5 "$HOME/.jobsitepro/contact-mail.log" 2>/dev/null || true
fi
