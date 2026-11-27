# JobsitePro — Import PocketBase FINAL

Un seul fichier pour tout importer en production (mode **Merge**).

## Fichier à utiliser

```
pocketbase/jobsitepro-final-import.json
```

**Ne pas utiliser** en même temps `pb_schema-import.json` + `knowify_collections_import.json` si vous importez déjà le FINAL.

## Générer / régénérer le fichier

```powershell
cd chantiertrack-v2
node pocketbase/build-final-import.mjs
```

Contenu fusionné :

| Source | Contenu |
|--------|---------|
| `pb_schema-import.json` | App complète (chantiers, pointages, dépenses, soumissions, paie, photos, etc.) |
| `knowify_collections_import.json` | CRM & Ops (clients, prospects, factures, journal, tickets…) |
| `payroll_gateway_collections.json` | Paie API (`payroll_runs`, `payroll_audit_log`) |
| `payroll_collections.json` | Champs paie complémentaires |

## Import dans PocketBase Admin

1. Ouvrir : `https://jobsitepro.example.com/_/` ou `http://127.0.0.1:8091/_/`
2. **Settings** → **Import collections**
3. **Load from JSON file** → `jobsitepro-final-import.json`
4. Cocher **Merge** / **Extend** (ne jamais remplacer toute la base si vous avez des données)
5. **Review** → confirmer
6. Redémarrer PocketBase / conteneur Docker

## Collections incluses (résumé)

### Cœur JobsitePro
`users`, `companies`, `sites`, `assignments`, `time_entries`, `shifts`, `leave_requests`, `safety_documents`, `safety_signatures`, `photos`, `incidents`, `expenses`, `soumissions`, `mileage_entries`, `pay_rates`, `pay_stubs`, `payroll_documents`, `payroll_access_log`, `notifications`, `job_costs`, `tracking_events`, `push_subscriptions`, `employee_payroll_profiles`, …

### CRM Knowify (menu patron — Leads, Factures, Daily Logs, …)
`clients`, `leads`, `factures`, `paiements`, `daily_logs`, `service_tickets`, `contrats`, `activity_events`, `quickbooks_sync`

Import détaillé par section : **`MENU-IMPORT-POCKETBASE-FR.md`**

### Paie avancée
`payroll_runs`, `payroll_audit_log`

## Vérification après import

```bash
curl -s "https://jobsitepro.example.com/api/collections/sites/records?perPage=1"
curl -s "https://jobsitepro.example.com/api/collections/expenses/records?perPage=1"
curl -s "https://jobsitepro.example.com/api/collections/clients/records?perPage=1"
```

→ HTTP **200** (pas 400 / 404).

Dans l’app patron (F12), recharger : plus d’erreurs rouges sur `api/collections/...`.

## Si l’import Knowify échoue (IDs relations)

Votre instance peut avoir d’autres IDs pour `companies` / `sites` :

1. Admin → **companies** → Export → noter l’`id` de la collection (ex. `pbc_…`)
2. Éditer `pocketbase/build-knowify-import.mjs` (constantes `CO`, `SITES`)
3. Relancer `node pocketbase/build-final-import.mjs`
4. Ré-importer `jobsitepro-final-import.json` en merge

## Fichiers à ne plus importer séparément

- ~~`knowify_collections.json`~~ (format invalide)
- ~~`pb_schema-import.json`~~ seul (sans CRM) — remplacé par FINAL
- Les `*_fields.json` (doc manuelle) — déjà inclus dans `pb_schema-import.json`
