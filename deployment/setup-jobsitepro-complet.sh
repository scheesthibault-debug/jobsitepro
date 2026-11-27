#!/usr/bin/env bash
# JobsitePro — configuration complète après migration example.com
# Usage sur le serveur :
#   cd /mnt/stockage/chantiertrack-v2/chantiertrack-v2
#   bash deployment/setup-jobsitepro-complet.sh
#
# Vous serez invité à coller la clé Resend (compte où example.com est Verified).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DOMAIN="jobsitepro.example.com"
CONTACT_ENV="$ROOT/services/contact-mail/.env"
HUB_ENV="$ROOT/services/integrations-hub/.env"

echo "=== JobsitePro — setup complet ==="
echo "Domaine: $DOMAIN"
echo ""

# ── 1. Domaine dans les fichiers app ──
echo "1/5 — Mise à jour domaine dans les fichiers..."
for f in \
  "$ROOT/patron/index.html" \
  "$ROOT/employe/index.html" \
  "$ROOT/site/index.html" \
  "$ROOT/site/presentation.html" \
  "$ROOT/pocketbase/pb_hooks/oauth_connectors.pb.js"
do
  if [[ -f "$f" ]]; then
    sed -i 's|jobsitepro\.example\.com|jobsitepro.example.com|g' "$f"
    sed -i 's|chantiertrack\.example\.com|jobsitepro.example.com|g' "$f"
  fi
done
echo "   OK"

# ── 2. Contact-mail (.env) ──
echo ""
echo "2/5 — Contact-mail (Resend)..."
if [[ ! -f "$CONTACT_ENV" ]]; then
  cp "$ROOT/deployment/contact-mail.env.server" "$CONTACT_ENV"
fi

read -r -p "Collez la clé Resend (re_...) du compte avec example.com Verified : " RESEND_KEY
if [[ -z "$RESEND_KEY" || "$RESEND_KEY" != re_* ]]; then
  echo "ERREUR: clé invalide (doit commencer par re_)"
  exit 1
fi

set_kv() {
  local key="$1" val="$2"
  if grep -q "^${key}=" "$CONTACT_ENV"; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$CONTACT_ENV"
  else
    echo "${key}=${val}" >> "$CONTACT_ENV"
  fi
}

set_kv RESEND_API_KEY "$RESEND_KEY"
set_kv CONTACT_FROM "noreply@example.com"
set_kv CONTACT_TO "contact@example.com"
set_kv MAIL_PROVIDER "resend"
set_kv CONTACT_SITE_URL "https://${DOMAIN}"
set_kv CONTACT_SITE_LABEL "$DOMAIN"
set_kv CORS_ORIGINS "https://${DOMAIN},http://127.0.0.1:8888,http://127.0.0.1:8888"

bash "$ROOT/deployment/install-contact-mail-user.sh" || true
echo "   contact-mail configuré"

# ── 3. Integrations-hub ──
echo ""
echo "3/5 — Integrations-hub (QuickBooks)..."
if [[ -f "$HUB_ENV" ]]; then
  sed -i "s|jobsitepro\.example\.com|${DOMAIN}|g" "$HUB_ENV"
fi
if [[ -f "$ROOT/deployment/integrations-hub.env.production.server" ]]; then
  sed -i "s|jobsitepro\.example\.com|${DOMAIN}|g" "$ROOT/deployment/integrations-hub.env.production.server"
fi
if bash "$ROOT/deployment/install-integrations-hub-user.sh" 2>/dev/null; then
  echo "   integrations-hub OK"
else
  echo "   WARN: hub non démarré (POCKETBASE_ADMIN_TOKEN ?) — voir ~/.jobsitepro/integrations-hub.log"
fi

# ── 4. Vérifications ──
echo ""
echo "4/5 — Tests locaux..."
curl -sf "http://127.0.0.1:3103/health" && echo "" || echo "   contact-mail: KO"
curl -sf "http://127.0.0.1:3102/health" && echo "" || echo "   integrations-hub: KO (normal si token manquant)"
curl -sf "http://127.0.0.1:8888/contact/health" && echo "" || echo "   nginx /contact/: KO"

# ── 5. Test envoi Resend ──
echo ""
echo "5/5 — Test envoi courriel..."
RESULT=$(curl -s -X POST "http://127.0.0.1:3103/api/send" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Setup","email":"test@example.com","message":"Test automatique setup JobsitePro"}')
echo "   Réponse: $RESULT"
if echo "$RESULT" | grep -q '"ok":true'; then
  echo ""
  echo "✅ SUCCÈS — courriel OK. Vérifie contact@example.com"
else
  echo ""
  echo "❌ Échec envoi — voir: tail -5 ~/.jobsitepro/contact-mail.log"
fi

echo ""
echo "=== À faire MANUELLEMENT (je ne peux pas le faire à ta place) ==="
echo "1. Intuit developer.intuit.com → Redirect URI Production :"
echo "   https://${DOMAIN}/api/jobsitepro/oauth/quickbooks/callback"
echo "2. Dockge → chantiertrack-pb → Redémarrer (si pas déjà fait)"
echo "3. Navigateur → Ctrl+Shift+R sur patron et site"
echo ""
