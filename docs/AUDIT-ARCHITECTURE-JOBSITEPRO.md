# Audit architecture — JobsitePro (mai 2026)

## 1. Résumé

| Élément | État actuel |
|---------|-------------|
| Stack prod | Vanilla JS PWA (`patron/`, `employe/`) + PocketBase |
| Prototypes | ~~`platform/`, `receipts-hub/`~~ — **supprimés** (juin 2026) |
| RBAC | `patron/js/auth-rbac.js` + `rbac-guards.js` + hooks partiels |
| QuickBooks | OAuth stub (`oauth_connectors.pb.js`), sync UI stub, router ajouté |
| OCR | `services/receipt-ocr/` + hook `receipt_ocr_proxy.pb.js` |

**Hypothèse retenue :** on garde vanilla PWA + copier-coller serveur (pas migration Next.js immédiate).

---

## 2. Problèmes par priorité

### Critique

| # | Problème | Impact |
|---|----------|--------|
| C1 | Champ `company` manquant sur `users` en prod | Import JSON échoue, règles API invalides |
| C2 | Tokens QuickBooks dans `integrations_config` (JSON public) | Fuite possible si refresh_token y est stocké |
| C3 | RBAC surtout côté UI | Contournement possible via API directe |
| C4 | Pas d’isolation chantier fine (assignments) dans les règles PB | Employé pourrait voir données hors affectation |

### Important

| # | Problème |
|---|----------|
| I1 | Double nommage ChantierTrack / JobsitePro |
| I2 | `responsibility_role` vs `rbac_role` (unifié dans UI, legacy en base) |
| I3 | `jobsitepro-final-import.json` invalide sur bases existantes |
| I4 | QuickBooks sync = stub (`pending-oauth`) sans routing réel |
| I5 | ~~`platform/` et `receipts-hub/`~~ — supprimés ; une seule app patron/employé |

### Amélioration

| # | Sujet |
|---|--------|
| A1 | `patron/index.html` monolithique (~9000 lignes) |
| A2 | Pas de tests unitaires sur RBAC / QB router |
| A3 | TypeScript seulement dans prototypes |

---

## 3. Structure cible (progressive)

```
chantiertrack-v2/
├── patron/                 # PWA desktop (prod)
│   └── js/
│       ├── auth-rbac.js    # permissions
│       ├── rbac-guards.js  # navigation
│       └── integrations/
│           └── qb-document-router.js
├── employe/                # PWA mobile (prod)
├── pocketbase/
│   ├── rbac-only-import.json
│   └── pb_hooks/
│       ├── rbac_guard.pb.js
│       ├── oauth_connectors.pb.js
│       └── qb_document_router.pb.js
├── shared/types/           # types TS référence
└── docs/                   # audits, guides
```

---

## 4. Flux document → OCR → QB

```
Employé scan reçu
  → POST /ocr/scan-receipt
  → expenses (status: draft)
Patron approuve
  → expenses.status = approved
  → JobsiteProQBDocumentRouter.routeDocumentToQuickBooks()
  → si allowed → quickbooks_sync (entity Purchase)
  → hook qb_document_router.pb.js valide
  → API Intuit (futur worker serveur)
```

---

## 5. Fichiers modifiés (cette passe)

| Fichier | Justification |
|---------|-------------|
| `patron/js/auth-rbac.js` | Libellés rôles unifiés (image 1) |
| `patron/index.html` | Un seul menu « Rôle » |
| `patron/js/integrations/qb-document-router.js` | Routing QB centralisé |
| `pocketbase/pb_hooks/qb_document_router.pb.js` | Validation serveur sync |
| `shared/types/jobsitepro.d.ts` | Types pour migration TS |
| `docs/AUDIT-ARCHITECTURE-JOBSITEPRO.md` | Ce document |

---

## 6. Actions manuelles restantes

1. PocketBase → users → ajouter champs `company` + `rbac_role` (voir `RBAC-IMPORT-MANUEL-FR.md`)
2. Copier `patron/`, `employe/`, `pb_hooks/` sur le serveur
3. Variables env : `QUICKBOOKS_CLIENT_ID`, `QUICKBOOKS_CLIENT_SECRET`
4. Ne pas stocker refresh_token dans `integrations_config` — collection `integration_tokens` (futur)
