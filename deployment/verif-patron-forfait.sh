#!/usr/bin/env bash
# Copie patron + js/css sur le serveur stockage (thibault, sans Windows)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PATRON="$ROOT/patron"
echo "=== Sync patron → stockage (Nginx 8888) ==="
test -f "$PATRON/index.html" || { echo "patron/index.html introuvable"; exit 1; }
test -f "$PATRON/js/rbac-guards.js" || { echo "patron/js/rbac-guards.js introuvable"; exit 1; }
test -f "$PATRON/js/product-plans.js" || { echo "patron/js/product-plans.js introuvable"; exit 1; }
echo "OK fichiers présents dans $PATRON"
echo "Nginx sert déjà ce dossier via nginx-chantiertrack-stockage.conf"
echo ""
echo "Vérification:"
grep -q "product-plans" "$PATRON/index.html" && echo "  [OK] index.html référence product-plans.js"
grep -q "planAllowsPage\|canAccessPatronPageByPlan" "$PATRON/js/rbac-guards.js" && echo "  [OK] rbac-guards filtre par forfait"
echo ""
echo "Dans le navigateur: Ctrl+Shift+R ou navigation privée sur /patron/"
echo "Compte dupont: PocketBase → companies → plan = basic ou terrain → déconnexion/reconnexion"
