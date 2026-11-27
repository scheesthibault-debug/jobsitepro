# Architecture paie ChantierTrack (Loi 25 — export uniquement)

ChantierTrack **ne calcule plus la paie** (impôts, RRQ/RPC, AE, bulletins officiels) et **n’est pas connecté** à des services bancaires. Le module paie compile les **heures travaillées** et produit un **export CSV éphémère** pour des services tiers (ex. Wagepoint).

## Principes

| Principe | Mise en œuvre |
|----------|----------------|
| Minimisation des données | Pas de brut/net/retenues stockés pour la paie courante |
| Éphémérité | CSV généré côté **client** (`Blob` + téléchargement, `revokeObjectURL`) |
| Responsabilité paie | Fournisseur externe (Wagepoint, comptable, etc.) |
| Heures source | Collection `time_entries` (règle 40 h / semaine ISO) |

## Stack

| Couche | Technologie |
|--------|-------------|
| UI patron | `patron/index.html` — section **Paie** |
| Agrégation heures | `patron/js/payroll/payroll-hours.js` |
| Export CSV | `patron/js/payroll/payroll-export.js` |
| Aperçu UI | `patron/js/payroll/payroll-export-ui.js` |
| Données | PocketBase : `time_entries`, `pay_rates`, `users` (lecture seule pour l’export) |

## Colonnes CSV (import standard)

`nom_employe`, `heures_régulières`, `heures_supplémentaires`, `date_début`, `date_fin`

Séparateur `;`, BOM UTF-8, décimales avec virgule.

## Fichiers actifs

```
patron/js/payroll/
  payroll-hours.js      # computeEmployeeHoursWeeklyOT (sans fiscal)
  payroll-export.js     # compilePayPeriodExport, exportPayPeriodCsv
  payroll-export-ui.js  # initPayExportUi, refreshPayExportPreview
```

## Fichiers hérités (non chargés par la page Paie)

`payroll-engine.js`, `payroll-simulator.js`, `paystub-preview.js` — conservés pour référence ou panneaux fiscaux masqués ; **ne pas** les utiliser pour la paie courante.

## Archive période

Le ZIP d’archive inclut `heures_paie_periode.xlsx` et `export_paie_wagepoint.csv` (heures uniquement, sans montants de paie calculés).

## Évolution API

Voir `PAYROLL_API_INTEGRATION.md` — toute intégration API doit rester **côté serveur** avec clés secrètes ; l’UI patron ne persiste pas de bulletins sensibles.

## Déploiement

Copier `patron/js/payroll/` vers le `pb_public` du serveur (voir `install-serveur-local.sh`).
