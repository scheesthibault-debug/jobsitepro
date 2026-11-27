#!/usr/bin/env bash
# Vérifie / démarre les services JobsitePro pour démo (sans sudo)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ok() { echo "  [OK] $*"; }
warn() { echo "  [--] $*"; }
fail() { echo "  [!!] $*"; }

echo "=== JobsitePro — état des services (démo) ==="
echo ""

echo "1. Contact mail (port 3103)"
if curl -sf "http://127.0.0.1:3103/health" >/dev/null 2>&1; then
  ok "$(curl -s http://127.0.0.1:3103/health)"
else
  warn "contact-mail inactif — lancement…"
  bash "$ROOT/deployment/install-contact-mail-user.sh" || fail "contact-mail — voir ~/.jobsitepro/contact-mail.log"
fi

echo ""
echo "2. OCR reçus (port 3101)"
if curl -sf "http://127.0.0.1:3101/health" >/dev/null 2>&1; then
  ok "$(curl -s http://127.0.0.1:3101/health | head -c 120)"
else
  warn "OCR inactif — sudo bash deployment/install-receipt-ocr.sh (ou systemd)"
fi

echo ""
echo "3. PocketBase API (port 8091)"
if curl -sf "http://127.0.0.1:8091/api/health" >/dev/null 2>&1; then
  ok "PocketBase 8091"
else
  warn "PocketBase 8091 ne répond pas"
fi

echo ""
echo "4. Nginx 8888"
if curl -sf "http://127.0.0.1:8888/patron/" >/dev/null 2>&1; then
  ok "patron/"
else
  warn "8888/patron/ inaccessible"
fi

if curl -sf "http://127.0.0.1:8888/site/" >/dev/null 2>&1; then
  ok "site/ (vitrine)"
else
  warn "8888/site/ — recopiez site/ + rechargez nginx"
fi

if curl -sf "http://127.0.0.1:8888/contact/health" >/dev/null 2>&1; then
  ok "contact/ (formulaire)"
else
  warn "8888/contact/ — ajoutez location nginx + reload"
fi

echo ""
echo "5. Integrations hub QuickBooks (port 3102)"
if curl -sf "http://127.0.0.1:3102/health" >/dev/null 2>&1; then
  ok "$(curl -s http://127.0.0.1:3102/health | head -c 80)"
else
  warn "3102 inactif — bash deployment/install-integrations-hub-user.sh"
fi

if curl -sf "http://127.0.0.1:8888/integrations/health" >/dev/null 2>&1; then
  ok "8888/integrations/health"
else
  warn "8888/integrations/ — nginx + hub"
fi

echo ""
echo "=== URLs pour votre ex-patron ==="
echo "  Patron  : https://jobsitepro.example.com/patron/"
echo "  Employé : https://jobsitepro.example.com/employe/"
echo "  Site    : https://jobsitepro.example.com/site/"
echo "  Contact : https://jobsitepro.example.com/site/contact.html"
echo ""
echo "  Réseau local (sans NPM):"
echo "  http://127.0.0.1:8888/patron/"
echo "  http://127.0.0.1:8888/employe/"
echo "  http://127.0.0.1:8888/site/"
