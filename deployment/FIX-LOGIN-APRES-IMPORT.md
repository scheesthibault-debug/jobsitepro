# Login impossible après import schéma

## Pourquoi ?

L’app appelle `https://jobsitepro.example.com/api/...` mais **deux bases PocketBase différentes** existent sur le serveur :

| Port | Contenu typique |
|------|-----------------|
| **8091** | Tes vrais users (`test@example.com`, etc.) |
| **8090** | Base vide ou test — **login échoue** |

Si NPM ou Nginx pointe vers **8090**, tu vois :
- Patron : « Email ou mot de passe incorrect »
- Employé : « Failed to authenticate »

L’import du schéma **n’efface pas** les users en mode merge, mais si tu te connectes à la **mauvaise** base, le compte n’y est pas.

---

## Étape 1 — Diagnostic (sur le serveur SSH)

```bash
cd /mnt/stockage/chantiertrack-v2/chantiertrack-v2
sudo bash deployment/diagnostic-login.sh test@example.com YOUR_PASSWORD
```

Regarde où ça affiche **login: OK** → c’est le bon port.

---

## Étape 2 — Corriger NPM (panneau serveur-maison)

| Domaine | Chemin | Service |
|---------|--------|---------|
| jobsitepro.example.com | `/api/jobsitepro` | `http://127.0.0.1:8888` |
| jobsitepro.example.com | `/ocr` | `http://127.0.0.1:8888` |
| jobsitepro.example.com | `*` | **`http://127.0.0.1:8091`** |

---

## Étape 3 — Nginx 8888 → API sur 8091

```bash
sudo sed -i 's|proxy_pass http://127.0.0.1:8090;|proxy_pass http://127.0.0.1:8091;|g' \
  /etc/nginx/sites-available/chantiertrack
sudo nginx -t && sudo systemctl reload nginx
```

---

## Étape 4 — Si login OK sur 8091 mais pas en public

Attendre 1 min, vider cache navigateur, reconnecter.

Sur mobile employé : **URL du serveur** = `https://jobsitepro.example.com` (sans port).

---

## Étape 5 — Si ECHEC partout (compte vraiment absent)

1. Admin : **http://127.0.0.1:8091/_/**
2. **Collections → users**
3. Chercher `test@example.com`
4. Si absent → **New record** : email, mot de passe, role `admin` ou `employe`, company liée
5. Si présent → **Edit** → nouveau mot de passe → Save

Puis retester login.

---

## Étape 6 — Vider cache app (navigateur / téléphone)

- Patron : F12 → Application → Clear site data → recharger
- Employé PWA : URL du serveur → vérifier `https://jobsitepro.example.com`

---

## Test rapide depuis ton PC

```powershell
curl.exe -s -X POST "https://jobsitepro.example.com/api/collections/users/auth-with-password" -H "Content-Type: application/json" -d "{\"identity\":\"test@example.com\",\"password\":\"YOUR_PASSWORD\"}"
```

- `"token"` → login OK côté serveur
- `"Failed to authenticate"` → mauvaise base ou mauvais mot de passe
