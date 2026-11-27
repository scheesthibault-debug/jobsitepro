# Importer les collections paie dans PocketBase

## Erreur « Invalid collections configuration »

L’ancien `payroll_collections.json` utilisait un format avec `"options": { ... }` — **refusé** par l’écran **Settings → Import collections**.

Utilisez le fichier corrigé : **`payroll_collections.json`** (même format que `expenses_collection.json`).

## Étapes

1. PocketBase Admin → **Settings** (engrenage) → **Import collections**
2. **Load from JSON file** → choisir `pocketbase/payroll_collections.json`
3. Cliquer **Review** puis confirmer l’import des **3** collections :
   - `employee_payroll_profiles` (`ct_payroll_profiles`)
   - `payroll_documents` (`ct_payroll_documents`)
   - `payroll_access_log` (`ct_payroll_access_log`)

## IDs alignés sur votre instance

D’après `pb_schema (1).json` :

| Collection cible | ID |
|----------------|-----|
| users (auth) | `_pb_users_auth_` |
| companies | `pbc_3866053794` |
| pay_stubs | `ct_paystubs` |

Si l’import échoue encore sur une relation, ouvrez **Collections → pay_stubs** et vérifiez que l’**ID** de la collection est bien `ct_paystubs` (pas seulement le nom).

## Option manuelle

Si l’import JSON refuse toujours : **New collection** pour chaque table et recopier les champs depuis ce fichier (noms identiques).

## Notifications (optionnel)

Votre schéma `notifications.type` n’inclut pas encore `paystub` ni `payroll_doc`. Ajoutez ces valeurs dans le champ **select type** de la collection `notifications`, sinon PocketBase peut rejeter les enregistrements.
