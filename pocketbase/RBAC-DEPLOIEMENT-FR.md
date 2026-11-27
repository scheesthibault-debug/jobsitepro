# RBAC JobsiteTrack — déploiement (copier-coller)

## Rôles dans l'app (menu unique « Rôle »)

| Libellé affiché | Code `rbac_role` | Accès |
|-----------------|------------------|-------|
| Administrateur | `admin_patron` | Tout |
| Gestionnaire | `gestionnaire` | Chantiers, CRM, approbations |
| Comptable | `comptable` | Finance, QuickBooks |
| Contremaître | `contremaitre` | Terrain |
| Sécurité SST | `securite_sst` | Section **Documents** seulement |
| Employé (mobile) | `employe` | `/employe/` |
| Lecture seule | `lecture_seule` | Lecture patron |

---

## 1. PocketBase — champ `rbac_role`

**Si l'import JSON échoue** (« unknown field company ») → voir **`RBAC-IMPORT-MANUEL-FR.md`** (ajout manuel en 2 minutes, sans JSON).

Sinon : `rbac-only-import.json` en mode **Merge**.

## 2. Copier sur le serveur

- `patron/` → `pb_public/patron/`
- `employe/` → `pb_public/employe/`
- `pocketbase/pb_hooks/rbac_guard.pb.js` → `pb_hooks/`

## 3. Ton compte

Users → ton email → `rbac_role` = **`admin_patron`**, `role` = **`admin`**

## 4. Recharger

Ctrl+Shift+R sur `/patron/`
