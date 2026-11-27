#!/usr/bin/env bash
# JobsitePro contact-mail — production Resend (domaine déjà vérifié sur le compte partagé)
# Usage: bash deployment/enable-resend-production.sh
#
# Pourquoi : onboarding@resend.dev (mode test) n'envoie qu'au Gmail du compte Resend.
# example.com est déjà vérifié dans Resend (autre projet) → envoi vers n'importe quelle boîte.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/services/contact-mail/.env"
CONTACT_TO="contact@example.com"
CONTACT_FROM="noreply@example.com"

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$ROOT/deployment/contact-mail.env.server" "$ENV_FILE"
  echo "Créé $ENV_FILE — ajoutez RESEND_API_KEY puis relancez."
  exit 1
fi

if ! grep -q '^RESEND_API_KEY=.\+' "$ENV_FILE"; then
  echo "ERREUR: RESEND_API_KEY manquant dans $ENV_FILE"
  exit 1
fi

set_kv() {
  local key="$1" val="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
  else
    echo "${key}=${val}" >> "$ENV_FILE"
  fi
}

set_kv CONTACT_TO "$CONTACT_TO"
set_kv CONTACT_FROM "$CONTACT_FROM"
set_kv MAIL_PROVIDER resend

echo "Production Resend activé :"
grep -E '^(CONTACT_TO|CONTACT_FROM|MAIL_PROVIDER)=' "$ENV_FILE"

bash "$ROOT/deployment/install-contact-mail-user.sh"
