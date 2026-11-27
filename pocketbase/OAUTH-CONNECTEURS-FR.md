# Connecteurs OAuth — QuickBooks & Wagepoint

## Interface patron

Menu latéral : sous **Analyse** (fermé = masqué), puis **QuickBooks** et **Wagepoint** (toujours visibles), puis **Paramètres**.

Chaque page intégration = **Connexion OAuth** + **Synchronisation** (Pousser / Tirer + journal `quickbooks_sync`).

## Champ PocketBase (entreprise)

Ajoutez sur la collection **`companies`** :

| Champ | Type | Description |
|-------|------|-------------|
| `integrations_config` | JSON | `{ quickbooks: { connected, email, connected_at }, wagepoint: { ... } }` |

Import merge : exécutez `node scripts/patch-pb-schema.mjs` puis ré-importez le schéma, **ou** ajoutez le champ à la main dans l’admin.

## Variables d’environnement (serveur PocketBase)

```env
PATRON_APP_URL=https://jobsitepro.example.com/patron/
PUBLIC_URL=https://jobsitepro.example.com
QUICKBOOKS_CLIENT_ID=votre_client_id
QUICKBOOKS_CLIENT_SECRET=votre_secret
QUICKBOOKS_REDIRECT_URI=https://jobsitepro.example.com/api/jobsitepro/oauth/quickbooks/callback
WAGEPOINT_CLIENT_ID=optionnel_si_partenaire
```

Créer l’app sur [Intuit Developer](https://developer.intuit.com/) → Redirect URI = `QUICKBOOKS_REDIRECT_URI`.

## Routes

| Route | Rôle |
|-------|------|
| `GET /api/jobsitepro/oauth/quickbooks/start?company=ID` | Démarre OAuth Intuit |
| `GET /api/jobsitepro/oauth/quickbooks/callback` | Retour OAuth → enregistre `integrations_config` |
| `GET /api/jobsitepro/oauth/wagepoint/start?company=ID&email=` | Wagepoint (OAuth si `WAGEPOINT_CLIENT_ID`, sinon lien manuel par courriel) |
| `GET /api/jobsitepro/oauth/wagepoint/callback` | Retour OAuth Wagepoint |

Hook : `pocketbase/pb_hooks/oauth_connectors.pb.js`

## Wagepoint

Wagepoint n’expose pas toujours une API OAuth publique. Sans `WAGEPOINT_CLIENT_ID`, le bouton **Connecter** enregistre le **courriel admin** confirmé (mode manuel). L’export des heures se fait via **Patron → Paie → Excel Wagepoint**.

Contact partenaire Wagepoint pour OAuth / API officielle.
