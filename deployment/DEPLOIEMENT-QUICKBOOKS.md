# Déploiement QuickBooks — JobsitePro (étape par étape)

Guide pour mettre en service la liaison **JobsitePro ↔ QuickBooks Online** sur ton serveur `127.0.0.1`.

**Temps estimé :** 45–60 min (dont création app Intuit).

---

## Vue d’ensemble

```
Patron → Connecter QuickBooks → Intuit OAuth (PocketBase hook)
Patron → Sync → integrations-hub :3102 → API QuickBooks
```

| Composant | Port / chemin |
|-----------|----------------|
| OAuth | `/api/jobsitepro/oauth/quickbooks/*` (PocketBase) |
| Sync API | `/integrations/` → `127.0.0.1:3102` |
| PocketBase | `8091` |

---

## ÉTAPE 1 — Intuit Developer (sur ton PC)

1. Va sur [developer.intuit.com](https://developer.intuit.com/) → **Sign in**
2. **Create an app** → **QuickBooks Online and Payments**
3. Nom : `JobsitePro`
4. **Keys & credentials** → copie **Client ID** et **Client Secret** (sandbox)
5. **Redirect URIs** → ajoute **exactement** :
   ```
   https://jobsitepro.example.com/api/jobsitepro/oauth/quickbooks/callback
   ```
6. Scopes : `com.intuit.quickbooks.accounting`, `openid`, `profile`, `email`

Garde Client ID + Secret pour les étapes 4 et 5.

---

## ÉTAPE 2 — Copier les fichiers (Windows PowerShell)

```powershell
cd <project-dir>
.\deployment\sync-integrations-vers-serveur.ps1
```

Copie : `integrations-hub`, hooks OAuth, scripts, nginx, modules patron QB.

---

## ÉTAPE 3 — Collections PocketBase (admin web)

1. Ouvre `https://jobsitepro.example.com/_/`
2. **Settings → Import collections**
3. Importe en **merge** : `pocketbase/integration_collections.json`
   - Crée : `integration_tokens`, `integration_mappings`, `sync_logs`
4. Collection **companies** → ajoute champ si absent :
   - Nom : `integrations_config`
   - Type : **JSON**

*(Ou exécute `node scripts/patch-pb-schema.mjs` si Node dispo.)*

---

## ÉTAPE 4 — Variables PocketBase (OAuth)

Les hooks OAuth lisent ces variables. Selon ton install :

**Docker** — ajoute dans `docker-compose` / env du conteneur PocketBase :

```env
QUICKBOOKS_CLIENT_ID=ton_client_id_sandbox
QUICKBOOKS_CLIENT_SECRET=ton_secret_sandbox
QUICKBOOKS_REDIRECT_URI=https://jobsitepro.example.com/api/jobsitepro/oauth/quickbooks/callback
QUICKBOOKS_ENVIRONMENT=sandbox
PATRON_APP_URL=https://jobsitepro.example.com/patron/
PUBLIC_URL=https://jobsitepro.example.com
```

**systemd** — dans le service `chantiertrack` ou fichier `.env` PocketBase.

Puis redémarre PocketBase.

---

## ÉTAPE 5 — Hooks PocketBase (sur le serveur)

```bash
cd /mnt/stockage/chantiertrack-v2/chantiertrack-v2
bash deployment/install-qb-hooks.sh
```

Si pas de sudo :

```bash
APP_DIR=/opt/chantiertrack bash deployment/install-qb-hooks.sh
# Puis redémarrer PocketBase manuellement (docker restart …)
```

---

## ÉTAPE 6 — Token admin PocketBase (pour le hub)

Le service sync a besoin d’un **token admin** PocketBase :

1. Admin PB → **Settings** (engrenage)
2. **Token** ou crée un **API Token** / superuser token (selon version PB)
3. Copie le token (longue chaîne)

---

## ÉTAPE 7 — integrations-hub (sur le serveur)

```bash
cd /mnt/stockage/chantiertrack-v2/chantiertrack-v2
cp services/integrations-hub/.env.example services/integrations-hub/.env
nano services/integrations-hub/.env
```

Remplis :

```env
PORT=3102
POCKETBASE_URL=http://127.0.0.1:8091
POCKETBASE_ADMIN_TOKEN=colle_ton_token_admin_ici
INTEGRATIONS_SERVICE_SECRET=une_longue_chaine_aleatoire

QUICKBOOKS_CLIENT_ID=meme_que_etape_4
QUICKBOOKS_CLIENT_SECRET=meme_que_etape_4
QUICKBOOKS_REDIRECT_URI=https://jobsitepro.example.com/api/jobsitepro/oauth/quickbooks/callback
QUICKBOOKS_ENVIRONMENT=sandbox

ALLOWED_ORIGINS=https://jobsitepro.example.com,http://127.0.0.1:8888
```

Démarre :

```bash
bash deployment/install-integrations-hub-user.sh
```

Test :

```bash
curl -s http://127.0.0.1:3102/health
curl -s http://127.0.0.1:8888/integrations/health
```

**Avec sudo** (alternative) : `sudo bash deployment/install-integrations-hub.sh`

---

## ÉTAPE 8 — Nginx (sudo une fois)

```bash
sudo cp deployment/nginx-chantiertrack-stockage.conf /etc/nginx/sites-available/chantiertrack
sudo nginx -t && sudo systemctl reload nginx
```

Le bloc ajouté :

```nginx
location /integrations/ {
    proxy_pass http://127.0.0.1:3102/;
    ...
}
```

**NPM** : si tout passe déjà par port **8888**, pas de location custom nécessaire.

---

## ÉTAPE 9 — Forfait Élite (pour voir le menu QB)

QuickBooks = forfait **Élite**. Dans PocketBase → **companies** :

- `plan` = `enterprise`

Ou compte de test dédié.

---

## ÉTAPE 10 — Test dans l’app

1. `https://jobsitepro.example.com/patron/` — connexion patron
2. Menu **QuickBooks**
3. **Connecter QuickBooks** → login Intuit **sandbox**
4. Autoriser l’app → retour JobsitePro « Connecté »
5. **Sync manuelle → QB** (clients, dépenses approuvées, factures)
6. **Importer clients** ← QuickBooks

Compte sandbox Intuit : utilise les identifiants de test fournis par Intuit dans le Developer Dashboard.

---

## Dépannage

| Problème | Solution |
|----------|----------|
| OAuth redirect error | Redirect URI **identique** dans Intuit et `QUICKBOOKS_REDIRECT_URI` |
| 404 sur `/integrations/` | Nginx pas rechargé ou hub pas démarré |
| Sync échoue 401 | `POCKETBASE_ADMIN_TOKEN` invalide ou expiré |
| Menu QB invisible | `plan` ≠ enterprise |
| `npm run build` échoue | Node 20+ recommandé |
| Hub health OK, public non | NPM doit pointer vers **8888** |

Logs hub : `tail -30 ~/.jobsitepro/integrations-hub.log`

---

## Checklist rapide

- [ ] App Intuit créée + Redirect URI
- [ ] `sync-integrations-vers-serveur.ps1` exécuté
- [ ] Collections `integration_*` importées
- [ ] `integrations_config` sur companies
- [ ] Variables QB sur PocketBase + redémarrage
- [ ] Hooks `oauth_connectors.pb.js` installés
- [ ] `.env` hub rempli + `install-integrations-hub-user.sh`
- [ ] Nginx `/integrations/` actif
- [ ] Entreprise en `plan=enterprise`
- [ ] Test OAuth + sync sandbox OK

---

## Fichiers utiles

| Fichier | Rôle |
|---------|------|
| `deployment/sync-integrations-vers-serveur.ps1` | Copie PC → serveur |
| `deployment/install-integrations-hub-user.sh` | Démarre hub sans sudo |
| `deployment/install-qb-hooks.sh` | Hooks OAuth |
| `docs/INTEGRATIONS-MVP-FR.md` | Doc technique détaillée |
| `pocketbase/OAUTH-CONNECTEURS-FR.md` | Routes OAuth |
