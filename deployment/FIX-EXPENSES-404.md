# Fix — « Missing or invalid collection context » à la soumission dépense

## Symptôme

Toast JSON brut à la soumission :

```json
{"data":{},"message":"Missing or invalid collection context.","status":404}
```

Le scan OCR peut fonctionner, mais **l’enregistrement dans PocketBase échoue**.

## Cause

La collection **`expenses`** (et souvent `companies`, `sites`, `time_entries`…) **n’existe pas** sur l’instance PocketBase servie par l’URL publique.

Test rapide (depuis n’importe où) :

```bash
curl -s "https://jobsitepro.example.com/api/collections/expenses/records?perPage=1"
# → 404 "Missing collection context."
```

Souvent : **8090** (base vide / test) vs **8091** (vraie base avec utilisateurs et données).

---

## Étape 1 — Vérifier sur le serveur

```bash
cd /mnt/stockage/chantiertrack-v2/chantiertrack-v2
sudo bash deployment/verify-pb-collections.sh
```

Repérez le port où `users` **et** `expenses` sont OK (HTTP 200 ou 403).

---

## Étape 2 — Nginx 8888 → la bonne base (8091)

```bash
sudo sed -i 's|proxy_pass http://127.0.0.1:8090;|proxy_pass http://127.0.0.1:8091;|g' \
  /etc/nginx/sites-available/chantiertrack
sudo nginx -t && sudo systemctl reload nginx
```

Ou recopier le fichier du projet (déjà corrigé en 8091) :

```bash
sudo cp deployment/nginx-chantiertrack-complet.conf /etc/nginx/sites-available/chantiertrack
sudo nginx -t && sudo systemctl reload nginx
```

---

## Étape 3 — Routes NPM (serveur-maison / Cloudflare)

| Domaine | Chemin | Service |
|---------|--------|---------|
| jobsitepro.example.com | `/api/jobsitepro` | `http://127.0.0.1:8888` |
| jobsitepro.example.com | `/ocr` | `http://127.0.0.1:8888` |
| jobsitepro.example.com | `*` | **`http://127.0.0.1:8091`** |

→ Login + API sur **8091**, scan OCR via **8888**.

---

## Étape 4 — Importer les collections manquantes (sans effacer les users)

1. Ouvrir l’admin PocketBase sur **8091** : `http://127.0.0.1:8091/_/`
2. **Settings → Import collections**
3. Choisir le fichier `pocketbase/pb_schema (2).json` du projet
4. Mode **Merge / étendre** (ne pas remplacer toute la base si vous avez déjà des users)
5. Redémarrer PocketBase si demandé :

```bash
sudo systemctl restart pocketbase
# ou le nom exact de votre service PB
```

---

## Étape 5 — Re-test

```bash
curl -s "https://jobsitepro.example.com/api/collections/expenses/records?perPage=1"
# doit retourner {"items":[...]} ou liste vide avec HTTP 200 — plus de 404
```

Puis sur le téléphone : rescanner un reçu → **Soumettre la dépense** → toast « Reçu soumis ✓ ».

---

## Déployer aussi le front + OCR (précision scan)

```bash
sudo bash deployment/deploy-depuis-cle-usb.sh
sudo cp services/receipt-ocr/*.js /opt/chantiertrack/receipt-ocr/
sudo systemctl restart chantiertrack-ocr
```
