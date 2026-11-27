# Serveur push — installation locale puis migration VPS

## Prérequis

- **Node.js 18+** ([nodejs.org](https://nodejs.org))
- **PocketBase** qui tourne (souvent `http://127.0.0.1:8090`)
- Collection **`push_subscriptions`** importée dans PocketBase  
  Fichier : `pocketbase/push_subscriptions_collection.json`  
  (format plat comme `expenses_collection.json` si l’import échoue)

---

## Partie A — Votre serveur actuel (PC / serveur maison)

### 1. Installer les dépendances

**PowerShell** (Windows) :

```powershell
cd <project-dir>\push
npm install
```

**Linux** :

```bash
cd /chemin/vers/chantiertrack-v2/push
npm install
```

### 2. Configurer `vapid.json`

```powershell
npm run vapid
```

Puis éditez `push/vapid.json` :

| Champ | Valeur |
|--------|--------|
| `pocketbaseUrl` | `http://127.0.0.1:8090` (ou l’URL de votre PB) |
| `adminToken` | PocketBase Admin → **Settings** → **Token de l’API** → générer un token **admin** et coller ici |
| `port` | `3099` (laisser par défaut) |

> Ne partagez jamais `privateKey` ni `adminToken`. Ne les commitez pas sur Git (`vapid.json` est dans `.gitignore`).

### 3. Démarrer le serveur push

```powershell
npm start
```

Vous devez voir :

```text
[chantiertrack-push] http://127.0.0.1:3099
[chantiertrack-push] adminToken: OK
```

### 4. Tester

```powershell
curl.exe http://127.0.0.1:3099/push/health
```

Réponse attendue : `{"ok":true,"hasAdminToken":true}`

### 5. Utiliser l’app ChantierTrack

1. PocketBase + apps **patron** / **employé** ouverts avec l’URL API = `http://127.0.0.1:8090` (ou votre IP:8090).
2. L’app détecte automatiquement le push sur le **port 3099** quand PocketBase est sur **8090**.
3. **Patron** → Paramètres / Sauvegarde → statut push « en ligne ».
4. **Employé** → **Plus** → **Activer les alertes** → accepter les notifications.

### 6. Téléphone sur le même réseau Wi‑Fi (optionnel)

Pour tester depuis un mobile vers votre PC :

```powershell
$env:PUSH_BIND="0.0.0.0"
npm start
```

- URL PocketBase dans l’app employé : `http://192.168.x.x:8090` (IP du PC).
- Le push sera sur `http://192.168.x.x:3099` (automatique si port 8090).

Pare-feu Windows : autoriser le port **3099** entrant.

### 7. Lancer au démarrage (Windows)

Créez un raccourci ou une tâche planifiée qui exécute :

```text
node <project-dir>\push\server.js
```

(avec le bon chemin vers `vapid.json` dans le même dossier `push`).

---

## Partie B — Migration vers le VPS (production)

Quand vous déployez sur `https://jobsitepro.example.com` :

### 1. Copier les fichiers (sans secrets)

Sur le VPS, depuis votre dépôt :

```bash
sudo mkdir -p /opt/chantiertrack/push
sudo cp push/package.json push/server.js push/generate-vapid.js /opt/chantiertrack/push/
cd /opt/chantiertrack/push
sudo npm install --omit=dev
```

### 2. Créer `vapid.json` sur le VPS

**Option A — nouvelles clés (recommandé en prod)** :

```bash
cd /opt/chantiertrack/push
sudo -u chantiertrack npm run vapid
sudo nano vapid.json
```

**Option B — reprendre les clés locales** (les abonnements push devront être refaits si vous changez les clés VAPID) :

- Copiez **uniquement** `vapid.json` du PC vers le VPS (SFTP / `scp`) :

```powershell
scp <project-dir>\push\vapid.json user@votre-vps:/opt/chantiertrack/push/vapid.json
```

Sur le VPS, adaptez :

```json
"pocketbaseUrl": "http://127.0.0.1:8090",
"adminToken": "… token admin PocketBase du VPS …"
```

### 3. Service systemd

```bash
sudo cp deployment/chantiertrack-push.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now chantiertrack-push
sudo systemctl status chantiertrack-push
```

### 4. Nginx (obligatoire en HTTPS)

Dans le `server { … }` HTTPS du site, **avant** la location `/` générale :

```nginx
location /push/ {
    proxy_pass http://127.0.0.1:3099/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### 5. Vérification prod

```bash
curl https://jobsitepro.example.com/push/health
```

→ `{"ok":true,"hasAdminToken":true}`

### 6. Ce qui change pour les utilisateurs

| Élément | Local | VPS |
|---------|--------|-----|
| URL API app | `http://IP:8090` | `https://domaine.com` |
| Push | `:3099` auto ou Nginx `/push/` | Nginx `/push/` |
| Abonnements | Collection `push_subscriptions` sur **votre** PocketBase | Même collection sur PB **VPS** (données à migrer avec PB si besoin) |

Les employés doivent **réactiver « Alertes »** sur le VPS (nouveau domaine = nouvel abonnement push).

### 7. Checklist migration

- [ ] PocketBase VPS + données importées
- [ ] Collection `push_subscriptions` présente
- [ ] `push/` installé + `vapid.json` + `adminToken`
- [ ] `chantiertrack-push` actif
- [ ] Nginx `location /push/`
- [ ] `/push/health` OK en HTTPS
- [ ] Test : message patron → notification employé

---

## Dépannage

| Symptôme | Action |
|----------|--------|
| `adminToken: MANQUANT` | Remplir `adminToken` dans `vapid.json`, redémarrer |
| 404 sur `/push/health` (prod) | Nginx : ajouter `location /push/` |
| Toast « serveur inaccessible » (local) | `npm start` dans `push/` + PB sur 8090 |
| Push OK mais rien reçu | Employé : bouton « Activer les alertes », PWA installée (iOS) |

Voir aussi : `PUSH_NOTIFICATIONS.md`
