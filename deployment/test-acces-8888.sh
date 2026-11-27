#!/bin/bash
# Vérifie pourquoi http://127.0.0.1:8888 ne répond pas depuis le réseau local
# Usage: sudo bash deployment/test-acces-8888.sh

set -e
LAN_IP="${LAN_IP:-127.0.0.1}"
PORT="${PORT:-8888}"

echo "=== JobsitePro — test accès port $PORT ==="
echo ""

echo "[1] Nginx actif ?"
systemctl is-active nginx 2>/dev/null || echo "nginx inactif"
echo ""

echo "[2] Qui écoute sur $PORT ?"
ss -tlnp | grep ":$PORT " || echo "RIEN sur le port $PORT — Nginx mal configuré"
echo ""

echo "[3] Fichiers employé / patron"
for d in /opt/chantiertrack/pb_public/employe/index.html /opt/chantiertrack/pb_public/patron/index.html; do
  if [ -f "$d" ]; then echo "  OK $d"; else echo "  MANQUANT $d — lancez deploy-depuis-cle-usb.sh"; fi
done
echo ""

echo "[4] Tests localhost"
for path in "/employe/" "/patron/" "/ocr/health" "/api/health"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT$path" 2>/dev/null || echo "000")
  echo "  127.0.0.1:$PORT$path → HTTP $code"
done
echo ""

echo "[5] Test IP LAN ($LAN_IP) depuis le serveur"
for path in "/employe/" "/ocr/health"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://$LAN_IP:$PORT$path" 2>/dev/null || echo "000")
  echo "  $LAN_IP:$PORT$path → HTTP $code"
done
echo ""

echo "[6] Pare-feu (ufw)"
if command -v ufw >/dev/null 2>&1; then
  ufw status 2>/dev/null | head -5 || true
  if ufw status 2>/dev/null | grep -q "Status: active"; then
    if ! ufw status | grep -q "$PORT"; then
      echo "  [!] Port $PORT peut être bloqué. Ouvrir:"
      echo "      sudo ufw allow $PORT/tcp"
    fi
  fi
else
  echo "  ufw non installé"
fi
echo ""

echo "=== URLs à ouvrir dans le navigateur (même Wi-Fi que le serveur) ==="
echo "  Employé : http://$LAN_IP:$PORT/employe/"
echo "  Patron  : http://$LAN_IP:$PORT/patron/"
echo "  OCR     : http://$LAN_IP:$PORT/ocr/health"
echo ""
echo "  Ne pas utiliser seulement http://$LAN_IP:$PORT/ (ça ouvre PocketBase, pas l'app PWA)."
