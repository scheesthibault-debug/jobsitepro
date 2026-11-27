# Intégrations QuickBooks + Wagepoint — MVP

## Architecture

```
patron/ (vanilla JS)
  → ChantierTrackConnectors (OAuth redirect Intuit)
  → ChantierTrackIntegrationsApi → /integrations/v1/*

services/integrations-hub/ (TypeScript Node :3101)
  ├── integrations/quickbooks/   client API + sync
  ├── integrations/wagepoint/    export CSV + stub API
  ├── services/oauth/            refresh token Intuit
  ├── services/sync/             file + retry
  └── services/webhooks/         Intuit webhooks

PocketBase
  ├── integration_tokens         secrets (admin only)
  ├── integration_mappings       local_id ↔ external_id
  ├── sync_logs                  journal lisible
  └── companies.integrations_config  statut public (sans tokens)
```

## Déploiement

### 1. Collections PocketBase

Importer en **merge** : `pocketbase/integration_collections.json`

Champ sur `companies` si absent : `integrations_config` (JSON).

### 2. Variables PocketBase

```env
QUICKBOOKS_CLIENT_ID=
QUICKBOOKS_CLIENT_SECRET=
QUICKBOOKS_REDIRECT_URI=https://jobsitepro.example.com/api/jobsitepro/oauth/quickbooks/callback
QUICKBOOKS_ENVIRONMENT=sandbox
PATRON_APP_URL=https://jobsitepro.example.com/patron/
```

Copier `pocketbase/pb_hooks/oauth_connectors.pb.js` → redémarrer PocketBase.

### 3. Service integrations-hub

```bash
cd services/integrations-hub
cp .env.example .env
# POCKETBASE_URL, POCKETBASE_ADMIN_TOKEN, QUICKBOOKS_*, INTEGRATIONS_SERVICE_SECRET
npm install
npm run dev
```

Nginx :

```nginx
location /integrations/ {
    proxy_pass http://127.0.0.1:3101/;
}
```

### 4. Intuit Developer

1. [developer.intuit.com](https://developer.intuit.com/) → app QuickBooks Online
2. Redirect URI = `QUICKBOOKS_REDIRECT_URI`
3. Scopes : `com.intuit.quickbooks.accounting`, `openid`, `profile`, `email`
4. Webhook (optionnel) → `POST /integrations/v1/webhooks/quickbooks/{companyId}`

## Utilisation patron

1. Menu **QuickBooks** → **Connecter QuickBooks** (OAuth Intuit)
2. **Sync manuelle → QB** : clients, dépenses approuvées, factures émises
3. Menu **Wagepoint** → **Exporter CSV Wagepoint** (heures clôturées)

## Règles métier MVP

| Règle | Implémentation |
|-------|----------------|
| Pas d'heure non approuvée vers paie | `clock_out` requis + `approved_for_payroll !== false` |
| Pas de doublon QB | `integration_mappings` unique par entité |
| Erreurs loguées | `sync_logs` + `last_error` sur mapping |
| Retry | file mémoire 3 tentatives (`sync-queue`) |
| Sandbox / prod | `QUICKBOOKS_ENVIRONMENT` |

## API hub

| Méthode | Route | Auth |
|---------|-------|------|
| GET | `/integrations/v1/health` | — |
| GET | `/integrations/v1/{companyId}/status` | Bearer patron |
| POST | `/integrations/v1/sync/run` | Bearer patron |
| POST | `/integrations/v1/webhooks/quickbooks/{companyId}` | Service secret |

Body sync (push → QB) :

```json
{
  "company": "company_id",
  "provider": "quickbooks",
  "direction": "push",
  "entity_types": ["client", "expense", "invoice"]
}
```

## Import QuickBooks → JobsitePro (pull)

Quand on relie un **compte QuickBooks existant**, on peut **rapatrier les données déjà présentes** dans QuickBooks vers JobsitePro.

- MVP : import des **clients** (QB `Customer` → collection `clients`).
- Lecture via l'API QuickBooks `SELECT * FROM Customer` (pagination automatique `STARTPOSITION`/`MAXRESULTS`).
- **Anti-doublon** : un client déjà importé (mapping `external_id` OU `clients.quickbooks_id`) est ignoré.
- Mapping des champs : `DisplayName→nom`, `PrimaryEmailAddr→email`, `PrimaryPhone→telephone`, `BillAddr→adresse/ville/province/code_postal`. La province est validée contre la liste autorisée (sinon laissée vide).
- Chaque import est journalisé dans `sync_logs` (`direction="pull"`).

Déclenchement depuis l'UI patron : bouton **« Importer mes clients QuickBooks »** (QuickBooks → JobsitePro), ou via l'API :

```json
{
  "company": "company_id",
  "provider": "quickbooks",
  "direction": "pull",
  "entity_types": ["client"]
}
```

Fichiers : `src/integrations/quickbooks/import-service.ts`, mapper `mapQbCustomerToClient`.

## TODO post-MVP

- [ ] TimeActivity QB (mapping employé → EmployeeRef)
- [ ] Import pull étendu : factures (`Invoice`), dépenses (`Purchase`), articles (`Item`)
- [ ] Pull QB via webhooks (résolution realm → company)
- [ ] API Wagepoint directe (`WagepointApiProvider`)
- [ ] Champ `approved_for_payroll` sur `time_entries`
- [ ] File Redis persistante pour retry
- [ ] Chiffrement at-rest `integration_tokens`

## Tests

```bash
cd services/integrations-hub
npm test
```
