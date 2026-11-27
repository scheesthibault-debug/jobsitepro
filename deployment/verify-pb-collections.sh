#!/usr/bin/env bash
# Vérifie que les collections JobsitePro existent sur PocketBase (8090 / 8091)
set -euo pipefail

COLS=(users companies sites time_entries expenses notifications mileage_entries incidents)

check_port() {
  local port="$1"
  echo ""
  echo "=== PocketBase :$port ==="
  if ! curl -sf "http://127.0.0.1:${port}/api/health" >/dev/null 2>&1; then
    echo "  [ECHEC] port $port injoignable"
    return 1
  fi
  echo "  [OK] health"
  local ok=0 fail=0
  for c in "${COLS[@]}"; do
    local code
    code=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${port}/api/collections/${c}/records?perPage=1")
    if [ "$code" = "200" ] || [ "$code" = "403" ]; then
      echo "  [OK]   $c (HTTP $code)"
      ok=$((ok + 1))
    else
      echo "  [MANQ] $c (HTTP $code) ← collection absente ou base vide"
      fail=$((fail + 1))
    fi
  done
  echo "  → $ok OK, $fail manquantes"
  [ "$fail" -eq 0 ]
}

check_port 8091 || true
check_port 8090 || true

echo ""
echo "Si expenses = MANQ sur le port utilisé par l'app → voir deployment/FIX-EXPENSES-404.md"
