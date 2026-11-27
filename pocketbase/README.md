# PocketBase — fichiers de configuration

| Fichier | Rôle |
|---------|------|
| `IMPORTER_DANS_POCKETBASE.json` | Import principal des collections |
| `expenses_collection.json` | Schéma / champs collection `expenses` |
| `responsibility_fields.json` | Champs responsabilité (documents) |
| `CONFIG_EMAIL_MOT_DE_PASSE.md` | Réinitialisation mot de passe par courriel |
| `PHOTOS_SUPPRESSION_ARCHIVE.md` | Suppression photos après archive ZIP |
| `payroll_collections.json` | **À importer manuellement** : `employee_payroll_profiles`, `payroll_documents`, `payroll_access_log` (TD1, T4/RL-1 PDF, audit) |
| `PUSH_NOTIFICATIONS.md` | Serveur Web Push (`/push/`) |
| `INSTALL_PUSH_SERVEUR.md` | **Installation locale + migration VPS** (guide pas à pas) |
| `push_subscriptions_collection.json` | Collection à importer pour les abonnements push |

`new_collections_fixed.json` a été retiré (doublon de l’import principal).

### Paie avancée (après import `payroll_collections.json`)

- **Heures sup.** : 40 h max **par semaine** (ISO), pas sur toute la période.
- **Patron** : section « Documents paie » → import PDF T4 / RL-1 ; pas de doublon de bulletins pour la même période employé.
- **Employé** : onglets Bulletins · T4/RL-1 · TD1 & dépôt direct.
