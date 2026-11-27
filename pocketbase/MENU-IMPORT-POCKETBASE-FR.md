# Import PocketBase — menu complet JobsitePro

## Fichier à importer (tout-en-un)

```
chantiertrack-v2/pocketbase/jobsitepro-final-import.json
```

Chemin absolu sur votre PC :

```
<project-dir>\pocketbase\jobsitepro-final-import.json
```

## Étapes dans PocketBase Admin

1. Ouvrir l’admin : `https://jobsitepro.example.com/_/` ou `http://127.0.0.1:8091/_/`
2. **Settings** → **Import collections**
3. **Load from JSON file** → sélectionner `jobsitepro-final-import.json`
4. Cocher **Merge** / **Extend** (ne pas « Replace » si vous avez déjà des données)
5. **Review** → confirmer l’import
6. Redémarrer PocketBase / Docker

## Régénérer le fichier après modification du schéma

```powershell
cd <project-dir>
node pocketbase/build-final-import.mjs
```

## Collections par section du menu patron

| Section menu | Collections PocketBase |
|--------------|------------------------|
| **Chantiers** | `sites`, `assignments`, `time_entries` |
| **Équipe** | `users`, `shifts`, `leave_requests` |
| **Documents** | `safety_documents`, `safety_signatures`, `photos`, `incidents` |
| **CRM** | `clients`, `leads`, `factures`, `paiements`, `daily_logs`, `service_tickets`, `contrats`, `activity_events`, `quickbooks_sync` |
| **Finance** | `pay_stubs`, `pay_rates`, `mileage_entries`, `expenses`, `soumissions`, `job_costs`, `payroll_*` |
| **Localisation** | `tracking_events` (carte) |
| **Analyse** | `activity_events`, rapports dérivés |

## Vérification rapide

```powershell
curl -s "http://127.0.0.1:8091/api/collections/clients/records?perPage=1"
curl -s "http://127.0.0.1:8091/api/collections/leads/records?perPage=1"
curl -s "http://127.0.0.1:8091/api/collections/factures/records?perPage=1"
```

Réponse attendue : JSON avec `"items"` (pas erreur 404).

## UI patron (sections repliables + FR/EN)

- Déployer le dossier `patron/` à jour (`sw.js` v105+)
- Bouton **FR / EN** en haut à droite
- Cliquer sur **CHANTIERS**, **ÉQUIPE**, **CRM**, etc. pour ouvrir/fermer la section

Guide détaillé : `JOBSITEPRO-FINAL-IMPORT-FR.md` et `KNOWIFY-SETUP-FR.md`.
