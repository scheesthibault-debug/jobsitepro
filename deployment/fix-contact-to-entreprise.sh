#!/usr/bin/env bash
# Corrige CONTACT_TO → boîte entreprise JobsitePro
# Usage: bash deployment/fix-contact-to-entreprise.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/services/contact-mail/.env"
TARGET="contact@example.com"

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$ROOT/deployment/contact-mail.env.server" "$ENV_FILE"
  echo "Créé $ENV_FILE — ajoutez RESEND_API_KEY puis relancez."
  exit 1
fi

if grep -q '^CONTACT_TO=' "$ENV_FILE"; then
  sed -i "s|^CONTACT_TO=.*|CONTACT_TO=$TARGET|" "$ENV_FILE"
else
  echo "CONTACT_TO=$TARGET" >> "$ENV_FILE"
fi

echo "CONTACT_TO=$TARGET"
grep '^CONTACT_TO=' "$ENV_FILE"

echo ""
echo "→ Active aussi l'expéditeur Resend production (domaine vérifié)…"
bash "$ROOT/deployment/enable-resend-production.sh"
