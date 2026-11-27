#!/usr/bin/env bash
# JobsitePro contact-mail — sans sudo (utilisateur titi)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SVC_DIR="$ROOT/services/contact-mail"
ENV_FILE="$SVC_DIR/.env"
LOG_DIR="$HOME/.jobsitepro"
PID_FILE="$LOG_DIR/contact-mail.pid"
LOG_FILE="$LOG_DIR/contact-mail.log"

mkdir -p "$LOG_DIR"

if [[ ! -d "$SVC_DIR" ]]; then
  echo "ERREUR: $SVC_DIR introuvable."
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$SVC_DIR/.env.example" "$ENV_FILE"
  echo "Créé $ENV_FILE"
  echo "Éditez RESEND_API_KEY puis relancez ce script."
  exit 1
fi

has_resend=false
has_brevo=false
has_smtp=false
grep -q '^RESEND_API_KEY=.\+' "$ENV_FILE" && has_resend=true
grep -q '^BREVO_API_KEY=.\+' "$ENV_FILE" && has_brevo=true
grep -q '^SMTP_HOST=.\+' "$ENV_FILE" && ! grep -q 'smtp.example.com' "$ENV_FILE" && has_smtp=true
if [[ "$has_resend" != true && "$has_brevo" != true && "$has_smtp" != true ]]; then
  echo "Éditez $ENV_FILE : RESEND_API_KEY=re_... (recommandé)"
  exit 1
fi

cd "$SVC_DIR"
if ! command -v npm >/dev/null 2>&1; then
  echo "ERREUR: npm manquant."
  exit 1
fi
# --no-bin-links : évite EPERM sur /mnt/stockage (Samba/USB)
npm install --omit=dev --no-bin-links

if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "Arrêt ancien processus $(cat "$PID_FILE")…"
  kill "$(cat "$PID_FILE")" || true
  sleep 1
fi

nohup node server.js >> "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"

sleep 1
if curl -sf "http://127.0.0.1:3103/health" >/dev/null; then
  echo "OK — contact-mail actif (PID $(cat "$PID_FILE"))"
  curl -s "http://127.0.0.1:3103/health"
  echo ""
  echo "Log: $LOG_FILE"
  echo "Nginx: location /contact/ → http://127.0.0.1:3103/"
else
  echo "WARN: health check échoué. Voir: tail -30 $LOG_FILE"
  exit 1
fi
