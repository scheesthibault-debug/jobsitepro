# JobsitePro — Modules Knowify (PocketBase)

Ces écrans sont dans **patron/** (menu **CRM**, libellés alignés Knowify). Ils nécessitent les collections PocketBase ci-dessous.

## 1. Importer les collections

**Recommandé (tout en un) :** `pocketbase/jobsitepro-final-import.json`  
(voir `JOBSITEPRO-FINAL-IMPORT-FR.md`)

Ou Knowify seul :

1. Ouvrir PocketBase Admin (`http://127.0.0.1:8091/_/` ou prod)
2. **Settings** → **Import collections** → **Merge**
3. Fichier : **`knowify_collections_import.json`** (ou le FINAL ci-dessus)
4. **Review** → confirmer

> ⚠️ N'utilisez **pas** `knowify_collections.json` (ancien format documentation seulement).

Collections importées : `clients`, `leads`, `factures`, `paiements`, `daily_logs`, `service_tickets`, `contrats`, `activity_events`, `quickbooks_sync`

### Si l'import échoue sur les relations

Votre PocketBase peut avoir des IDs différents pour `companies` / `sites`. Pour vérifier :
- Admin → Collections → companies → ⋮ → Export
- Comparez l'`id` de la collection (ex. `pbc_3866053794`)
- Si différent, éditez `pocketbase/build-knowify-import.mjs` puis :
  ```powershell
  node pocketbase/build-knowify-import.mjs
  ```

## 2. Champs booléens par défaut

À la création, définir les valeurs par défaut :
- `clients.is_active` → `true`
- `factures.montant_paye` → `0`, `solde` → `0`, `relance_envoyee` → `false`
- `daily_logs.auto_genere` → `false`

## 3. Lancer patron

```powershell
cd chantiertrack-v2/patron
npx serve -p 8081
```

Connexion admin → menu **Clients**, **Leads**, **Invoices**, **Daily Logs**, **Work Orders**, **Contracts**, **Scheduling**.

## 4. Flux Knowify

| Étape | Écran |
|-------|--------|
| Lead | Leads → Convert to client |
| Devis | Soumissions (Quotes) |
| Chantier | Chantiers (Jobs) |
| Facture | Invoices → Payment |
| Daily Log | Daily Logs → Generate (time + expenses + photos) |
| Rentabilité | Rentabilité (revenus vs coûts) |

## 5. QuickBooks

Page **QuickBooks** + carte dans **Paramètres** : stub OAuth. Brancher `QUICKBOOKS_CLIENT_ID` côté serveur pour prod.

## 6. Optionnel — lier clients aux chantiers

Sur collection `sites`, ajouter relation `client` → `clients` (max 1).

Sur `soumissions`, ajouter relation `client` → `clients` (max 1) en plus de `client_nom`.
