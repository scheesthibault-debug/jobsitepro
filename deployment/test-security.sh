#!/usr/bin/env bash
# JobsitePro — tests d'autorisation (aucune secret en dur).
#
# Requis:
#   PB_URL              ex. http://127.0.0.1:8091
#   PB_ADMIN_EMAIL      superuser PocketBase
#   PB_ADMIN_PASSWORD
#
# Optionnel:
#   TEST_PASSWORD       mot de passe des comptes de test (défaut: TestPass123!)
#
# Quitte 0 si tous les checks passent.
set -euo pipefail

PB_URL="${PB_URL:?Set PB_URL (ex. http://127.0.0.1:8091)}"
PB_ADMIN_EMAIL="${PB_ADMIN_EMAIL:?Set PB_ADMIN_EMAIL}"
PB_ADMIN_PASSWORD="${PB_ADMIN_PASSWORD:?Set PB_ADMIN_PASSWORD}"
TEST_PASSWORD="${TEST_PASSWORD:-TestPass123!}"
API="${PB_URL%/}/api"

PASS=0
FAIL=0
TS=$(date +%s)
SUFFIX="sec${TS}"

log() { printf '%s\n' "$*"; }
ok() { PASS=$((PASS + 1)); log "OK  $*"; }
bad() { FAIL=$((FAIL + 1)); log "FAIL $*"; }

json_get() {
  # json_get <json> <key> — extrait une clé top-level simple
  local json="$1" key="$2"
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$json" | jq -r --arg k "$key" '.[$k] // empty'
    return
  fi
  printf '%s' "$json" | sed -n "s/.*\"${key}\"[[:space:]]*:[[:space:]]*\"\\([^\"]*\\)\".*/\\1/p" | head -1
}

req() {
  local method="$1" path="$2" token="${3:-}" body="${4:-}"
  local args=(-sS -X "$method" -H "Content-Type: application/json")
  if [[ -n "$token" ]]; then
    args+=(-H "Authorization: Bearer $token")
  fi
  if [[ -n "$body" ]]; then
    args+=(-d "$body")
  fi
  args+=(-w "\n%{http_code}" "$API$path")
  curl "${args[@]}"
}

split_body_code() {
  BODY=$(printf '%s' "$1" | sed '$d')
  CODE=$(printf '%s' "$1" | tail -n1)
}

# ── Superuser auth (PB 0.22 admins / 0.23+ _superusers) ─────────
log "== Auth superuser =="
RAW=$(req POST "/admins/auth-with-password" "" "{\"identity\":\"${PB_ADMIN_EMAIL}\",\"password\":\"${PB_ADMIN_PASSWORD}\"}" || true)
split_body_code "$RAW"
if [[ "$CODE" != "200" ]]; then
  RAW=$(req POST "/collections/_superusers/auth-with-password" "" "{\"identity\":\"${PB_ADMIN_EMAIL}\",\"password\":\"${PB_ADMIN_PASSWORD}\"}" || true)
  split_body_code "$RAW"
fi
if [[ "$CODE" != "200" ]]; then
  log "Cannot authenticate admin (HTTP $CODE). Body: $BODY"
  exit 2
fi
ADMIN_TOKEN=$(json_get "$BODY" token)
[[ -n "$ADMIN_TOKEN" ]] || { log "No admin token"; exit 2; }
ok "superuser token"

# ── Fixtures: two companies + users ─────────────────────────────
log "== Fixtures =="
mk_company() {
  local name="$1"
  local r
  r=$(req POST "/collections/companies/records" "$ADMIN_TOKEN" "{\"name\":\"${name}\",\"is_active\":true,\"plan\":\"basic\"}")
  split_body_code "$r"
  if [[ "$CODE" != "200" ]]; then
    log "company create failed HTTP $CODE $BODY"
    exit 2
  fi
  json_get "$BODY" id
}

CO_A=$(mk_company "SecTest A ${SUFFIX}")
CO_B=$(mk_company "SecTest B ${SUFFIX}")
ok "companies $CO_A / $CO_B"

mk_user() {
  local email="$1" role="$2" company="$3" rbac="$4"
  local r
  r=$(req POST "/collections/users/records" "$ADMIN_TOKEN" \
    "{\"email\":\"${email}\",\"password\":\"${TEST_PASSWORD}\",\"passwordConfirm\":\"${TEST_PASSWORD}\",\"role\":\"${role}\",\"rbac_role\":\"${rbac}\",\"company\":\"${company}\",\"name\":\"${email}\",\"emailVisibility\":true,\"is_active\":true}")
  split_body_code "$r"
  if [[ "$CODE" != "200" ]]; then
    log "user create failed $email HTTP $CODE $BODY"
    exit 2
  fi
  json_get "$BODY" id
}

auth_user() {
  local email="$1"
  local r
  r=$(req POST "/collections/users/auth-with-password" "" \
    "{\"identity\":\"${email}\",\"password\":\"${TEST_PASSWORD}\"}")
  split_body_code "$r"
  if [[ "$CODE" != "200" ]]; then
    log "auth failed $email HTTP $CODE"
    exit 2
  fi
  json_get "$BODY" token
}

EMAIL_ADMIN_A="admin-a-${SUFFIX}@example.com"
EMAIL_EMP_A="emp-a-${SUFFIX}@example.com"
EMAIL_EMP_B="emp-b-${SUFFIX}@example.com"
EMAIL_ADMIN_B="admin-b-${SUFFIX}@example.com"
EMAIL_ATTACK="attack-${SUFFIX}@example.com"

ADMIN_A_ID=$(mk_user "$EMAIL_ADMIN_A" "admin" "$CO_A" "admin_patron")
EMP_A_ID=$(mk_user "$EMAIL_EMP_A" "employe" "$CO_A" "employe")
EMP_B_ID=$(mk_user "$EMAIL_EMP_B" "employe" "$CO_A" "employe")
ADMIN_B_ID=$(mk_user "$EMAIL_ADMIN_B" "admin" "$CO_B" "admin_patron")
ok "fixture users"

TOKEN_ADMIN_A=$(auth_user "$EMAIL_ADMIN_A")
TOKEN_EMP_A=$(auth_user "$EMAIL_EMP_A")
TOKEN_ADMIN_B=$(auth_user "$EMAIL_ADMIN_B")

# Pay stub for employee B (same company as A)
STUB_R=$(req POST "/collections/pay_stubs/records" "$ADMIN_TOKEN" \
  "{\"employee\":\"${EMP_B_ID}\",\"company\":\"${CO_A}\",\"period_start\":\"2026-01-01\",\"period_end\":\"2026-01-15\",\"gross\":1000,\"net\":800}")
split_body_code "$STUB_R"
if [[ "$CODE" != "200" ]]; then
  # champs optionnels selon schéma — retry minimal
  STUB_R=$(req POST "/collections/pay_stubs/records" "$ADMIN_TOKEN" \
    "{\"employee\":\"${EMP_B_ID}\",\"company\":\"${CO_A}\"}")
  split_body_code "$STUB_R"
fi
STUB_ID=$(json_get "$BODY" id)
[[ -n "$STUB_ID" ]] || { log "pay_stub create failed HTTP $CODE $BODY"; exit 2; }
ok "pay_stub for emp B"

# Sites A + B
SITE_A_R=$(req POST "/collections/sites/records" "$ADMIN_TOKEN" \
  "{\"name\":\"Site A ${SUFFIX}\",\"company\":\"${CO_A}\",\"status\":\"active\"}")
split_body_code "$SITE_A_R"
SITE_A_ID=$(json_get "$BODY" id)
[[ -n "$SITE_A_ID" ]] || { log "site A create failed HTTP $CODE $BODY"; exit 2; }

SITE_R=$(req POST "/collections/sites/records" "$ADMIN_TOKEN" \
  "{\"name\":\"Site B ${SUFFIX}\",\"company\":\"${CO_B}\",\"status\":\"active\"}")
split_body_code "$SITE_R"
SITE_B_ID=$(json_get "$BODY" id)
[[ -n "$SITE_B_ID" ]] || { log "site B create failed HTTP $CODE $BODY"; exit 2; }
ok "sites $SITE_A_ID / $SITE_B_ID"

json_bool() {
  local json="$1" key="$2"
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$json" | jq -r --arg k "$key" '.[$k] | tostring'
    return
  fi
  printf '%s' "$json" | sed -n "s/.*\"${key}\"[[:space:]]*:[[:space:]]*\\(true\\|false\\).*/\\1/p" | head -1
}

# ── (a) Privilege escalation at public signup ───────────────────
log "== (a) signup role escalation =="
ATT_R=$(req POST "/collections/users/records" "" \
  "{\"email\":\"${EMAIL_ATTACK}\",\"password\":\"${TEST_PASSWORD}\",\"passwordConfirm\":\"${TEST_PASSWORD}\",\"role\":\"admin\",\"rbac_role\":\"admin_patron\",\"company\":\"${CO_A}\",\"name\":\"Attacker\",\"emailVisibility\":true,\"is_active\":true}")
split_body_code "$ATT_R"
ATT_ID=$(json_get "$BODY" id)
ATT_ROLE=$(json_get "$BODY" role)
ATT_RBAC=$(json_get "$BODY" rbac_role)
ATT_ACTIVE=$(json_bool "$BODY" is_active)
if [[ "$CODE" == "200" && -n "$ATT_ID" && "$ATT_ROLE" == "employe" && "$ATT_ACTIVE" == "false" ]]; then
  ok "(a) attacker forced role=employe is_active=false (rbac=${ATT_RBAC:-?})"
elif [[ "$CODE" == "200" && "$ATT_ROLE" == "employe" && "$ATT_ACTIVE" != "false" ]]; then
  bad "(a) role ok but is_active=$ATT_ACTIVE (expected false)"
elif [[ "$CODE" == "200" && "$ATT_ROLE" == "admin" ]]; then
  bad "(a) attacker still role=admin — hook manquant ou non chargé"
else
  if [[ "$CODE" != "200" ]]; then
    ok "(a) create rejected HTTP $CODE (acceptable if guarded)"
  else
    bad "(a) unexpected response role=$ATT_ROLE is_active=$ATT_ACTIVE HTTP $CODE"
  fi
fi

# ── (b) Employee A cannot list B's pay stubs ────────────────────
log "== (b) pay_stubs peer isolation =="
FILTER_ENC=$(python3 -c "import urllib.parse; print(urllib.parse.quote('employee=\"${EMP_B_ID}\"'))" 2>/dev/null \
  || node -e "console.log(encodeURIComponent('employee=\"${EMP_B_ID}\"'))" 2>/dev/null \
  || printf 'employee%%3D%%22%s%%22' "$EMP_B_ID")
LIST_R=$(req GET "/collections/pay_stubs/records?filter=${FILTER_ENC}" "$TOKEN_EMP_A")
split_body_code "$LIST_R"
TOTAL=""
if command -v jq >/dev/null 2>&1; then
  TOTAL=$(printf '%s' "$BODY" | jq -r '.totalItems // (.items|length) // 0')
else
  TOTAL=$(json_get "$BODY" totalItems)
fi
TOTAL="${TOTAL:-0}"
if [[ "$CODE" == "200" && "$TOTAL" == "0" ]]; then
  ok "(b) emp A listed 0 stubs for emp B"
elif [[ "$CODE" == "403" || "$CODE" == "400" ]]; then
  ok "(b) list denied HTTP $CODE"
else
  bad "(b) emp A saw totalItems=$TOTAL HTTP $CODE (expected 0)"
fi

LIST_ALL=$(req GET "/collections/pay_stubs/records?perPage=50" "$TOKEN_EMP_A")
split_body_code "$LIST_ALL"
if command -v jq >/dev/null 2>&1; then
  SEEN=$(printf '%s' "$BODY" | jq -r --arg id "$STUB_ID" '[.items[]?.id] | index($id) | if .==null then "no" else "yes" end')
else
  if printf '%s' "$BODY" | grep -q "$STUB_ID"; then SEEN=yes; else SEEN=no; fi
fi
if [[ "$SEEN" == "no" ]]; then
  ok "(b) stub $STUB_ID not visible in emp A list"
else
  bad "(b) stub $STUB_ID visible to emp A"
fi

# ── (c) Admin A cannot PATCH company B record ───────────────────
log "== (c) cross-company admin write =="
PATCH_R=$(req PATCH "/collections/sites/records/${SITE_B_ID}" "$TOKEN_ADMIN_A" "{\"name\":\"Hacked by A ${SUFFIX}\"}")
split_body_code "$PATCH_R"
if [[ "$CODE" == "403" || "$CODE" == "404" ]]; then
  ok "(c) admin A cannot PATCH site of company B (HTTP $CODE)"
elif [[ "$CODE" == "200" ]]; then
  bad "(c) admin A PATCHed company B site — rule missing company scope"
else
  ok "(c) write blocked HTTP $CODE"
fi

# ── (d) Employee cannot change own role ─────────────────────────
log "== (d) self role escalation =="
SELF_R=$(req PATCH "/collections/users/records/${EMP_A_ID}" "$TOKEN_EMP_A" "{\"role\":\"admin\",\"rbac_role\":\"admin_patron\"}")
split_body_code "$SELF_R"
if [[ "$CODE" == "403" || "$CODE" == "400" || "$CODE" == "404" ]]; then
  ok "(d) emp cannot PATCH own role (HTTP $CODE)"
elif [[ "$CODE" == "200" ]]; then
  NEW_ROLE=$(json_get "$BODY" role)
  if [[ "$NEW_ROLE" == "admin" ]]; then
    bad "(d) emp escalated to admin"
  else
    ok "(d) PATCH returned but role stayed $NEW_ROLE"
  fi
else
  ok "(d) blocked HTTP $CODE"
fi

# ── (e) Inactive employee cannot list company sites ─────────────
log "== (e) inactive employee sites isolation =="
if [[ -n "${ATT_ID:-}" ]]; then
  IN_AUTH=$(req POST "/collections/users/auth-with-password" "" \
    "{\"identity\":\"${EMAIL_ATTACK}\",\"password\":\"${TEST_PASSWORD}\"}")
  split_body_code "$IN_AUTH"
  TOKEN_INACTIVE=$(json_get "$BODY" token)
  if [[ "$CODE" == "200" && -n "${TOKEN_INACTIVE:-}" ]]; then
    SITES_R=$(req GET "/collections/sites/records?perPage=50" "$TOKEN_INACTIVE")
    split_body_code "$SITES_R"
    SITE_TOTAL=""
    if command -v jq >/dev/null 2>&1; then
      SITE_TOTAL=$(printf '%s' "$BODY" | jq -r '.totalItems // (.items|length) // 0')
    else
      SITE_TOTAL=$(json_get "$BODY" totalItems)
    fi
    SITE_TOTAL="${SITE_TOTAL:-0}"
    if [[ "$CODE" == "200" && "$SITE_TOTAL" == "0" ]]; then
      ok "(e) inactive emp listed 0 sites"
    elif [[ "$CODE" == "403" || "$CODE" == "400" ]]; then
      ok "(e) sites denied HTTP $CODE"
    else
      bad "(e) inactive emp saw sites totalItems=$SITE_TOTAL HTTP $CODE"
    fi
  else
    bad "(e) could not auth inactive user HTTP $CODE"
  fi
else
  ok "(e) skipped (no public signup user)"
fi

# ── (f) Employee cannot create time_entry for another company ───
log "== (f) cross-company time_entry create =="
TE_R=$(req POST "/collections/time_entries/records" "$TOKEN_EMP_A" \
  "{\"employee\":\"${EMP_A_ID}\",\"company\":\"${CO_B}\",\"clock_in\":\"2026-01-15T12:00:00.000Z\"}")
split_body_code "$TE_R"
if [[ "$CODE" == "403" || "$CODE" == "400" || "$CODE" == "404" ]]; then
  ok "(f) emp A cannot create time_entry for company B (HTTP $CODE)"
elif [[ "$CODE" == "200" ]]; then
  TE_ID=$(json_get "$BODY" id)
  [[ -n "$TE_ID" ]] && req DELETE "/collections/time_entries/records/${TE_ID}" "$ADMIN_TOKEN" >/dev/null || true
  bad "(f) emp A created time_entry with foreign company"
else
  ok "(f) blocked HTTP $CODE"
fi

# Cleanup best-effort (superuser)
log "== Cleanup =="
for id in "$ATT_ID" "$EMP_A_ID" "$EMP_B_ID" "$ADMIN_A_ID" "$ADMIN_B_ID"; do
  [[ -n "${id:-}" ]] || continue
  req DELETE "/collections/users/records/${id}" "$ADMIN_TOKEN" >/dev/null || true
done
[[ -n "${STUB_ID:-}" ]] && req DELETE "/collections/pay_stubs/records/${STUB_ID}" "$ADMIN_TOKEN" >/dev/null || true
[[ -n "${SITE_A_ID:-}" ]] && req DELETE "/collections/sites/records/${SITE_A_ID}" "$ADMIN_TOKEN" >/dev/null || true
[[ -n "${SITE_B_ID:-}" ]] && req DELETE "/collections/sites/records/${SITE_B_ID}" "$ADMIN_TOKEN" >/dev/null || true
req DELETE "/collections/companies/records/${CO_A}" "$ADMIN_TOKEN" >/dev/null || true
req DELETE "/collections/companies/records/${CO_B}" "$ADMIN_TOKEN" >/dev/null || true

log ""
log "Result: $PASS passed, $FAIL failed"
if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
exit 0
