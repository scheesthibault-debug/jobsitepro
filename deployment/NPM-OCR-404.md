# JobsitePro — corriger OCR et Push HTTP 404 (Nginx Proxy Manager)

Sans ces deux routes, l’employé voit :
- **« Service OCR (HTTP 404) »** — scan reçu impossible
- **« Serveur push non installé sur le site »** — alertes navigateur impossibles

L’app employé appelle :
- `https://jobsitepro.example.com/ocr/scan-receipt` (POST image)
- `https://jobsitepro.example.com/push/health` et `/push/vapid-public`

Ces chemins doivent être proxifiés vers Nginx **8888** (qui relaie vers 3101 OCR et 3099 push), pas vers PocketBase seul.

## Diagnostic

```bash
# Sur le serveur Linux — doit répondre JSON
curl -s http://127.0.0.1:3101/health
curl -s http://127.0.0.1:8888/ocr/health

# Depuis votre PC — si 404 ici, c’est NPM (vérifié mai 2026)
curl -s https://jobsitepro.example.com/ocr/health
curl -s https://jobsitepro.example.com/push/health
```

| Résultat | Cause |
|----------|--------|
| 3101 OK, 8888 OK, domaine **404** | NPM sans locations `/ocr/` et `/push/` |
| 3101 refuse | Service `chantiertrack-ocr` arrêté (voir `FIX-OCR-SERVEUR.txt`) |
| 8888 502 | Nginx local sans bloc `location /ocr/` |

## NPM — votre écran « Proxy Host » (photo 1)

Si vous avez **une seule ligne** comme sur la capture :

| Champ | Valeur correcte |
|--------|------------------|
| Domain | `jobsitepro.example.com` (minuscules OK) |
| Forward | `http://127.0.0.1:8888` |
| Status | Online |

→ **Pas obligatoire** d’ajouter des Custom locations : tout le site (`/employe/`, `/ocr/`, `/push/`) part vers le Nginx du serveur sur le port **8888**.

À vérifier quand même :

1. **SSL** : si les téléphones ouvrent `https://…`, activez un certificat (Let’s Encrypt) dans NPM — « HTTP Only » bloque le HTTPS.
2. **Serveur** : `curl http://127.0.0.1:8888/ocr/health` doit répondre **200** (pas 502). Si 502 → `sudo bash deployment/fix-ocr-502.sh` puis `sudo bash deployment/fix-nginx-ocr.sh`.

## NPM — Custom Location (seulement si 404 persiste)

1. Ouvrir **Nginx Proxy Manager** → Proxy Host `jobsitepro.example.com`
2. Onglet **Custom locations** → Add location
3. **Location** : `/ocr/`
4. **Forward hostname / IP** : `127.0.0.1` (ou IP du serveur)
5. **Forward port** : `8888`
6. **Forward path** : `/ocr/` (ou laisser vide selon votre version NPM)
7. **Ajouter une 2e location** :
   - **Location** : `/push/`
   - **Forward port** : `8888`
   - **Forward path** : `/push/`
8. Sauvegarder, puis retester les deux URLs ci-dessus (doivent répondre **200**, pas 404).

Alternative : forward port **3101** (OCR) ou **3099** (push) directement avec path `/`.

## Déployer le correctif client

Copier sur le serveur (USB) :

- `employe/js/expense-receipt-scan.js`
- `employe/sw.js` (cache v99)

Recharger l’app (vider cache PWA ou « hard refresh »).
