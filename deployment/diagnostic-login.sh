#!/usr/bin/env bash
# Trouve sur quel port PocketBase le compte existe + état collections
# Usage: sudo bash deployment/diagnostic-login.sh [email] [password]
set -euo pipefail

EMAIL="${1:-test@example.com}"
PASS="${2:-YOUR_PASSWORD}"

try_login() {
  local port="$1"
  curl -sf "http://127.0.0.1:${port}/api/health" >/dev/null 2>&1 || return 1
  local body
  body=$(curl -s -X POST "http://127.0.0.1:${port}/api/collections/users/auth-with-password" \
    -H 'Content-Type: application/json' \
    -d "{\"identity\":\"${EMAIL}\",\"password\":\"${PASS}\"}" 2>/dev/null || true)
  if echo "$body" | grep -q '"token"'; then
    echo "OK"
    echo "$body" | head -c 200
    return 0
  fi
  echo "ECHEC: $(echo "$body" | grep -o '"message":"[^"]*"' | head -1 || echo "$body" | head -c 120)"
  return 1
}

check_col() {
  local port="$1" col="$2"
  curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${port}/api/collections/${col}/records?perPage=1"
}

echo "=== Diagnostic login JobsitePro ==="
echo "Email: $EMAIL"
echo ""

for port in 8091 8090 8888; do
  echo "--- Port $port ---"
  if ! curl -sf "http://127.0.0.1:${port}/api/health" >/dev/null 2>&1; then
    echo "  [injoignable]"
    echo ""
    continue
  fi
  echo -n "  login: "
  try_login "$port" || true
  echo -n "  expenses: "
  check_col "$port" expenses
  echo -n "  | users: "
  check_col "$port" users
  echo ""
done

echo ""
echo "=== Interprétation ==="
echo "• Login OK sur 8091 seulement → NPM doit pointer * vers 8091 (pas 8090)"
echo "• Login OK sur 8888 seulement → nginx proxy OK; vérifier NPM → 8888 ou 8091"
echo "• ECHEC partout → compte absent ou mauvais mot de passe → admin PocketBase:"
echo "    http://127.0.0.1:8091/_/ → Collections → users → réinitialiser mot de passe"
echo ""
echo "Test public:"
curl -s -X POST "https://jobsitepro.example.com/api/collections/users/auth-with-password" \
  -H 'Content-Type: application/json' \
  -d "{\"identity\":\"${EMAIL}\",\"password\":\"${PASS}\"}" | head -c 180
echo ""
