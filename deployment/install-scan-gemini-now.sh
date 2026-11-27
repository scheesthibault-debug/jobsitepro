#!/bin/bash
# Installe le scan Gemini MAINTENANT (hook PocketBase + vérif)
# Usage: cd .../chantiertrack-v2 && sudo bash deployment/install-scan-gemini-now.sh
#    ou: sudo bash deployment/install-scan-gemini-now.sh "AIza..."

set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="${APP_DIR:-/opt/chantiertrack}"
DOMAIN="${DOMAIN:-jobsitepro.example.com}"
GEMINI_KEY="${1:-}"

echo "=== JobsitePro — installation scan Gemini ==="
[ "$(id -u)" -eq 0 ] || { echo "sudo requis"; exit 1; }

# 1) Service OCR + Gemini
if [ -f "$ROOT/deployment/install-receipt-ocr.sh" ]; then
  bash "$ROOT/deployment/install-receipt-ocr.sh"
fi
if [ -n "$GEMINI_KEY" ] && [ -f "$ROOT/deployment/configure-gemini-ocr.sh" ]; then
  bash "$ROOT/deployment/configure-gemini-ocr.sh" "$GEMINI_KEY"
fi

# 2) Hook PocketBase (scan via /api/jobsitepro/ — fonctionne sans NPM /ocr/)
mkdir -p "$APP_DIR/pb_hooks" "$APP_DIR/pb_data/pb_hooks"
if [ -f "$ROOT/pocketbase/pb_hooks/receipt_ocr_proxy.pb.js" ]; then
  cp -f "$ROOT/pocketbase/pb_hooks/receipt_ocr_proxy.pb.js" "$APP_DIR/pb_hooks/"
  cp -f "$ROOT/pocketbase/pb_hooks/receipt_ocr_proxy.pb.js" "$APP_DIR/pb_data/pb_hooks/"
else
  cat > "$APP_DIR/pb_data/pb_hooks/receipt_ocr_proxy.pb.js" << 'HOOK'
/// <reference path="../pb_data/types.d.ts" />
const OCR_LOCAL = 'http://127.0.0.1:3101';
function forwardJson(e, res) {
  const code = res.statusCode || 502;
  if (res.json != null) return e.json(code, res.json);
  return e.json(code, { ok: false, error: (res.raw || 'OCR vide').slice(0, 200) });
}
routerAdd('GET', '/api/jobsitepro/ocr-health', (e) => {
  try {
    const res = $http.send({ url: OCR_LOCAL + '/health', method: 'GET', timeout: 15 });
    return forwardJson(e, res);
  } catch (err) {
    return e.json(503, { ok: false, error: String(err) });
  }
});
routerAdd('POST', '/api/jobsitepro/scan-receipt', (e) => {
  try {
    const info = $apis.requestInfo(e);
    const headers = { 'content-type': 'application/json' };
    const auth = info.headers?.authorization || info.headers?.Authorization || '';
    if (auth) headers.Authorization = auth;
    const body = info.rawBody || JSON.stringify(info.data || {});
    const res = $http.send({
      url: OCR_LOCAL + '/scan-receipt', method: 'POST', headers, body, timeout: 120,
    });
    return forwardJson(e, res);
  } catch (err) {
    return e.json(503, { ok: false, manual: true, error: String(err) });
  }
});
HOOK
  cp -f "$APP_DIR/pb_data/pb_hooks/receipt_ocr_proxy.pb.js" "$APP_DIR/pb_hooks/"
fi
chown -R chantiertrack:chantiertrack "$APP_DIR/pb_hooks" "$APP_DIR/pb_data/pb_hooks" 2>/dev/null || true
echo "[OK] Hook → $APP_DIR/pb_data/pb_hooks/receipt_ocr_proxy.pb.js"

# 3) App employé (JS scan)
mkdir -p "$APP_DIR/pb_public/employe/js"
if [ -f "$ROOT/employe/js/expense-receipt-scan.js" ]; then
  cp -f "$ROOT/employe/js/expense-receipt-scan.js" "$APP_DIR/pb_public/employe/js/"
  cp -f "$ROOT/employe/index.html" "$APP_DIR/pb_public/employe/" 2>/dev/null || true
  cp -f "$ROOT/employe/sw.js" "$APP_DIR/pb_public/employe/" 2>/dev/null || true
  echo "[OK] employe/js/expense-receipt-scan.js déployé"
fi

# 4) Redémarrages — forcer hooksDir si service systemd existe
if [ -f /etc/systemd/system/chantiertrack.service ]; then
  if ! grep -q 'hooksDir' /etc/systemd/system/chantiertrack.service; then
    sed -i "s|serve --http=|serve --hooksDir=$APP_DIR/pb_data/pb_hooks --http=|" /etc/systemd/system/chantiertrack.service
    systemctl daemon-reload
    echo "[OK] systemd → --hooksDir=$APP_DIR/pb_data/pb_hooks"
  fi
fi

# 5) Redémarrages
systemctl restart chantiertrack-ocr 2>/dev/null || true
systemctl restart chantiertrack 2>/dev/null || true
sleep 2

# 6) Nginx bypass (scan sans hook PocketBase)
if [ -f "$ROOT/deployment/fix-scan-nginx-bypass.sh" ]; then
  bash "$ROOT/deployment/fix-scan-nginx-bypass.sh"
fi

echo ""
echo "=== Tests ==="
echo -n "Gemini local 3101: "
curl -sf http://127.0.0.1:3101/health | grep -q '"gemini":true' && echo OK || echo ECHEC — configurez la clé Gemini
echo -n "Nginx 8888 scan:   "
curl -sf http://127.0.0.1:8888/api/jobsitepro/ocr-health | grep -q '"ok":true' && echo OK || echo ECHEC — lancez fix-scan-nginx-bypass.sh
echo -n "Hook PB 8090:      "
curl -sf http://127.0.0.1:8090/api/jobsitepro/ocr-health | grep -q '"ok":true' && echo OK || echo optionnel — Nginx bypass suffit
echo -n "Public HTTPS:      "
PUB=$(curl -sf "https://$DOMAIN/api/jobsitepro/ocr-health" 2>/dev/null || echo FAIL)
echo "$PUB" | head -c 120
echo ""
if echo "$PUB" | grep -q '"gemini":true'; then
  echo ""
  echo "[SUCCÈS] Scan prêt. Sur le téléphone: fermer l'app employé, rouvrir, rescanner."
elif curl -sf http://127.0.0.1:8888/api/jobsitepro/ocr-health | grep -q '"gemini":true'; then
  echo ""
  echo "[OK LAN] Scan OK sur http://127.0.0.1:8888 — corriger NPM (port 8888) pour le HTTPS public."
else
  echo ""
  echo "[!] Vérifiez: sudo bash deployment/fix-scan-nginx-bypass.sh"
fi
