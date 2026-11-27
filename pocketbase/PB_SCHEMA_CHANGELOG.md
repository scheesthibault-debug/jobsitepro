# Mise à jour `pb_schema (2).json` — Juin 2026

Fichiers mis à jour :
- `Downloads/pb_schema (2).json`
- `pocketbase/pb_schema (2).json`

Regénérer : `node scripts/patch-pb-schema.mjs`

## Nouveautés / corrections

### `expenses` (Dext)
- `vendor`, `tax_amount`, `manager_note`, `employee_note`
- `ocr_raw`, `ocr_confidence`
- `receipt` : JPEG, PNG, WebP, HEIC, **PDF** + thumbs 80x80, 200x200

### `companies`
- `mileage_rate` (aide: défaut 0.70 $/km)
- `tax_province`, `soumission_prefix`, `soumission_next_num`

### `sites` (coûts chantier)
- `soumission`, `budget_labor`, `budget_materials`, `budget_expenses`

### `notifications`
- **createRule** : employés peuvent créer (`company = @request.auth.company`)
- Types : `expense`, `leave`, `paystub`, `payroll_doc`, **`soumission`**

### `soumissions` (Knowify)
Collection `ct_soumissions` — phases JSON, montants HT/TPS/TVQ/TTC, statut, PDF

### `tracking_events`
- Règles API normalisées (patron + employé)

## Import PocketBase

**Ne pas ré-importer tout le schéma** sur une instance en production.

Ajoutez les champs **manuellement** dans l'admin PocketBase, ou importez **uniquement** la collection `soumissions` si elle n'existe pas.
