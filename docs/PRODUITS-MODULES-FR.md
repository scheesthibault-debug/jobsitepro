# JobsitePro — Forfaits modulaires

> **Règle clé :** documents **sécurité** + **GPS** + **pointage** = **un seul pack Terrain**.  
> **Pas de signature SST → pas de pointage** (déjà actif dans l’app + hook PocketBase).

---

## Les 3 forfaits

| Forfait PocketBase (`companies.plan`) | Nom commercial | Contenu |
|--------------------------------------|----------------|---------|
| `basic` ou `terrain` ou `standard` | **Standard** | GPS, carte live, pointage, chantiers, docs sécurité, photos, incidents |
| `pro` ou `finances` ou `premium` | **Premium** | Standard + scan reçus + dépenses + km |
| `enterprise` ou `complet` ou `elite` | **Élite** | + CRM Knowify, paie export, QuickBooks |

---

## Tarifs commerciaux (CAD)

**Formule :** `forfait fixe / mois` **+ 8 $ × employés actifs** (ceux qui pointent ; le patron n’est pas compté).

| Forfait | Fixe / mois | + / employé | Ex. 5 emp. | Ex. 10 emp. | Ex. 20 emp. |
|---------|-------------|-------------|------------|-------------|-------------|
| **Standard** | **59 $** | **8 $** | 99 $ | 139 $ | 219 $ |
| **Premium** | **79 $** | **8 $** | 119 $ | 159 $ | 239 $ |
| **Élite** | **139 $** | **8 $** | 179 $ | 219 $ | 299 $ |

**Phrase commerciale :**  
> « 59 $/mois pour la plateforme + 8 $ par employé qui pointe. »

**Essai :** 30 jours gratuits (sans carte).  
**PocketBase :** `companies.plan` = `basic` (Standard), `pro` (Premium), `enterprise` (Élite).

---

## Pack Standard (GPS + sécurité — liés)

**Employé**
- Pointer (GPS) — **bloqué** si docs sécurité non signés
- Onglet Docs (signer SST)
- Photos, incident
- Accueil + chantiers assignés

**Patron**
- Carte live, pointages, chantiers, employés
- Documents sécurité, photos, travaux, problèmes, incidents

**Pas inclus :** scan reçu, dépenses comptables, CRM

### Déjà en place (rien à réinstaller)

1. **App employé** : bouton pointage verrouillé + message « signer les documents »
2. **Hook PocketBase** : `pocketbase/pb_hooks/safety_sign_clock_guard.pb.js` — refuse `time_entries` si doc SST manquant

---

## Pack Finances (add-on)

- Scan reçu OCR (employé)
- Dépenses (patron approuve)
- Kilométrage

**Séparé du GPS** — un client peut avoir Finances sans… non, Finances **inclut toujours Terrain** (le pointage reste le cœur chantier).

---

## Changer le forfait d’un client

PocketBase Admin → **Companies** → champ `plan` :

- `terrain` — GPS + sécurité seulement  
- `pro` — GPS + reçus  
- `enterprise` — tout  

Après changement : l’employé / patron recharge l’app (ou reconnecte).

---

## Fichiers code

| Fichier | Rôle |
|---------|------|
| `patron/js/product-plans.js` | Filtre menu patron |
| `employe/js/product-plans.js` | Filtre onglets employé |
| `patron/js/rbac-guards.js` | RBAC + forfait combinés |

---

## Vendre en 2 produits seulement ?

| Produit | `plan` |
|---------|--------|
| **JobsitePro Standard** (GPS + SST) | `basic` / `standard` |
| **JobsitePro Élite** (Standard + reçus + CRM) | `enterprise` / `elite` |

Le intermédiaire `pro` / **Premium** = Standard + reçus sans CRM.
