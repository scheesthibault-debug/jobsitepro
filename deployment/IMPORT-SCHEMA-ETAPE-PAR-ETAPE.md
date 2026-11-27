# Import PocketBase — étapes exactes

## Quel fichier importer ?

**Un seul fichier (recommandé) :**

```
pocketbase/jobsitepro-final-import.json
```

(App + CRM Knowify + paie — généré par `node pocketbase/build-final-import.mjs`)

Ancien fichier (sans CRM) : `pb_schema-import.json` — remplacé par le FINAL.

Sur le serveur après sync USB :

```
.../pocketbase/jobsitepro-final-import.json
```

---

## Étape 1 — Admin PocketBase (8091)

1. Ouvrir : **http://127.0.0.1:8091/_/**
2. Se connecter en admin

---

## Étape 2 — Importer (mode merge)

1. Menu **Settings** (engrenage)
2. **Import collections**
3. Choisir **`jobsitepro-final-import.json`**
4. Cocher **Merge / étendre** (ne pas remplacer toute la base)
5. Confirmer l’import

→ Crée `expenses`, `sites`, `time_entries`, etc. sans effacer tes users.

---

## Étape 3 — Redémarrer PocketBase

```bash
sudo systemctl restart pocketbase
# ou le nom exact de ton service, ex. chantiertrack-pb
```

---

## Étape 4 — Nginx → 8091

```bash
sudo sed -i 's|proxy_pass http://127.0.0.1:8090;|proxy_pass http://127.0.0.1:8091;|g' \
  /etc/nginx/sites-available/chantiertrack
sudo nginx -t && sudo systemctl reload nginx
```

---

## Étape 5 — Routes NPM (panneau serveur-maison)

| Domaine | Chemin | Port |
|---------|--------|------|
| jobsitepro.example.com | `/api/jobsitepro` | **8888** |
| jobsitepro.example.com | `/ocr` | **8888** |
| jobsitepro.example.com | `*` | **8091** |

---

## Étape 6 — Déployer app + OCR (taxes / TOTAL corrigés)

```bash
cd /mnt/stockage/chantiertrack-v2/chantiertrack-v2
sudo bash deployment/deploy-depuis-cle-usb.sh
sudo cp services/receipt-ocr/*.js /opt/chantiertrack/receipt-ocr/
sudo systemctl restart chantiertrack-ocr
```

---

## Étape 7 — Vérifier

```bash
curl -s "https://jobsitepro.example.com/api/collections/expenses/records?perPage=1"
# → HTTP 200 (plus de 404)

curl -s "https://jobsitepro.example.com/api/jobsitepro/ocr-health"
# → "gemini":true
```

Sur le téléphone : rescanner le reçu **Working Dog Saloon** → attendu :

| Champ | Valeur |
|-------|--------|
| Fournisseur | WORKING DOG SALOON |
| Montant TTC | **34.17** |
| Taxes (HST) | **3.93** |
| Catégorie | Repas |

---

## Si ça bloque encore

```bash
sudo bash deployment/verify-pb-collections.sh
```

Toutes les lignes `expenses`, `sites`, `companies` doivent être **[OK]** sur le port **8091**.
