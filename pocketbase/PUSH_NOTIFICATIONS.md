# Notifications push (PWA fermée)

Pour que l’employé reçoive une **vraie notification** sur l’écran du téléphone (comme une app native), même si ChantierTrack est fermé :

## 1. Collection PocketBase

Importer **`push_subscriptions_collection.json`** dans l’admin PocketBase  
(Collections → Import → ou créer à la main avec les mêmes champs et règles.)

## 2. Serveur push (VPS)

Sur le serveur (`/opt/chantiertrack/push/`) :

```bash
cd /opt/chantiertrack/push
npm install
npm run vapid
```

1. Ouvrir **`vapid.json`**
2. PocketBase Admin → **Settings → Token de l’API** → générer un token **admin**
3. Coller dans `"adminToken": "..."`
4. Vérifier `"pocketbaseUrl": "http://127.0.0.1:8090"`

```bash
# Service systemd (voir deployment/chantiertrack-push.service)
sudo systemctl enable --now chantiertrack-push
```

## 3. Nginx

Ajouter dans le `server` HTTPS :

```nginx
location /push/ {
    proxy_pass http://127.0.0.1:3099/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

Puis `sudo nginx -t && sudo systemctl reload nginx`.

Test : `https://votre-domaine.com/push/health` → `{"ok":true,"hasAdminToken":true}`

**Si vous voyez** `File not found` ou HTTP 404 → Nginx n’envoie pas `/push/` au service Node (étape 3 manquante).

### Vérification rapide (depuis votre PC)

```bash
curl https://jobsitepro.example.com/push/health
```

| Réponse | Signification |
|---------|----------------|
| `{"ok":true,"hasAdminToken":true}` | Tout est bon |
| `{"ok":true,"hasAdminToken":false}` | Service OK — remplir `adminToken` dans `vapid.json` |
| `File not found` / 404 | Ajouter `location /push/` dans Nginx + `systemctl start chantiertrack-push` |
| Timeout / connexion refusée | Service Node arrêté ou port 3099 bloqué |

## 4. Côté employé

1. Installer l’app sur l’**écran d’accueil** (PWA)
2. **Plus** → **Activer les alertes** → Accepter
3. L’abonnement est enregistré dans `push_subscriptions`

## 5. Côté patron

Rien de plus : à chaque message (Affectations, notification, rappel document), l’app appelle `/push/send` automatiquement.

## Dépannage

| Problème | Solution |
|----------|----------|
| Pas de push | `push/health` sans adminToken → remplir vapid.json |
| Service arrêté | `systemctl status chantiertrack-push` |
| Employé n’a pas activé | Bouton « Activer les alertes » |
| iPhone | iOS 16.4+ + PWA installée depuis Safari (pas seulement un onglet) |
