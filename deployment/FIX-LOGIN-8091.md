# Fix connexion après passage au port 8888

## Pourquoi « Email ou mot de passe incorrect »

Avant, dans **Routes des applications publiées** :

```
jobsitepro.example.com  →  8091   ← ton compte est ICI
```

Après changement pour le scan :

```
jobsitepro.example.com  →  8888  →  Nginx envoie /api/ vers 8090  ← AUTRE base
```

**8091 ≠ 8090** — ce ne sont pas les mêmes utilisateurs PocketBase.

---

## Solution recommandée (login + scan)

### Étape 1 — Remettre la route principale sur 8091

Dans **Routes des applications publiées** :

| Domaine | Chemin | Service |
|---------|--------|---------|
| jobsitepro.example.com | `*` | `http://127.0.0.1:8091` |

→ **Login refonctionne** comme avant.

### Étape 2 — Ajouter 2 routes OCR (même domaine, chemin précis)

Dans le **même panneau**, ajouter **2 lignes** (ordre important : chemins spécifiques avant le `*`) :

| Domaine | Chemin | Service |
|---------|--------|---------|
| jobsitepro.example.com | `/api/jobsitepro` | `http://127.0.0.1:8888` |
| jobsitepro.example.com | `/ocr` | `http://127.0.0.1:8888` |

Si l’outil ne permet qu’un chemin par domaine, utiliser l’**étape 3** (Nginx serveur).

### Étape 3 — Alternative : Nginx 8888 → API sur 8091

Sur le serveur, faire pointer l’API de 8888 vers **8091** (ta vraie base) :

```bash
sudo sed -i 's|proxy_pass http://127.0.0.1:8090;|proxy_pass http://127.0.0.1:8091;|g' \
  /etc/nginx/sites-available/chantiertrack
sudo nginx -t && sudo systemctl reload nginx
```

Puis garder **jobsitepro → 8888** dans Routes publiées.

Login + scan sur la **même** base 8091.

---

## Vérifier où est ton compte (sur le serveur)

```bash
curl -s -X POST http://127.0.0.1:8090/api/collections/users/auth-with-password \
  -H 'Content-Type: application/json' \
  -d '{"identity":"you@example.com","password":"YOUR_PASSWORD"}'

curl -s -X POST http://127.0.0.1:8091/api/collections/users/auth-with-password \
  -H 'Content-Type: application/json' \
  -d '{"identity":"you@example.com","password":"YOUR_PASSWORD"}'
```

- Celui qui retourne `"token"` → **c’est le bon port** pour ton login.

---

## Résumé

| Problème | Cause | Fix |
|----------|-------|-----|
| OCR 404 | Route sur 8091 sans scan | Chemins `/api/jobsitepro` → 8888 |
| Login impossible | 8888 → base 8090 | Revenir 8091 OU nginx api → 8091 |

**Ne change pas le mot de passe tout de suite** — c’est surtout le mauvais serveur PocketBase.
