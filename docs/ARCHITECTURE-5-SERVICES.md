# JobsitePro — Équivalents des 5 services cibles

> **Une seule app terrain** : `patron/` + `employe/` + PocketBase.

---

## Tableau : ce que tu veux vs ce qui existe

| # | Service cible | Équivalent JobsitePro | Où c’est | Déployer ? |
|---|---------------|----------------------|----------|------------|
| **1** | **QuickBooks** (compta) | OAuth + sync clients, dépenses, factures, temps | `patron/js/knowify/quickbooks-module.js` · `services/integrations-hub/` · hook PB `oauth_connectors.pb.js` | **Oui** — hub port **3102** |
| **2** | **Wagepoint** (paie légale) | **Externe** — export heures Excel/CSV depuis Paie | `patron` section Paie · `payroll-export.js` | **Non** d’API directe (lois) |
| **3** | **QuickBooks Time** | Pointage GPS employé + horaires patron | `employe/` clock-in · `time_entries` · patron Pointages/Horaires | **Oui** — natif PocketBase |
| **4** | **Knowify** | CRM + soumissions + coûts chantier + factures | `patron/js/knowify/*` · `soumissions/*` · `job-costing/*` | **Oui** — tout dans patron PWA |
| **5** | **Reçus / OCR** (ex-Dext) | Scan employé → Gemini → dépenses → approbation patron | `employe/js/expense-receipt-scan.js` · `receipt-ocr` · `patron/js/depenses/dext-expenses-ui.js` | **Oui** — flux mobile |

---

## Schéma production

```
Employé (GSM)                    Patron (GSM ou PC)
    │                                  │
    ├─ Pointage GPS ───────────────────┼─ Pointages / Horaires
    ├─ Scanner reçu ─────────────────┼─ Dépenses → Approuver
    └─ /employe/                     └─ /patron/ (CRM, coûts, paie)
              │                                │
              └────────── PocketBase ──────────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
         receipt-ocr   integrations-hub   Export Excel
         (Gemini)      (QuickBooks OAuth)   (heures → Wagepoint)
         port 3101      port 3102
```

---

## Prototypes supprimés (nettoyage repo)

| Dossier | Raison |
|---------|--------|
| `receipts-hub/` | Doublon Next.js + OCR |
| `platform/` | Doublon CRM + inbox PostgreSQL |
| `services/payroll-gateway/` | Stub Wagepoint inutile |

Tout est couvert par **patron + employé + PocketBase**.

---

## Stack VPS minimale

| Composant | Rôle |
|-----------|------|
| PocketBase | Base unique |
| `patron/` + `employe/` | Apps PWA |
| `push/` | Notifications |
| `receipt-ocr/` | Scan IA reçus |
| `integrations-hub/` | QuickBooks OAuth + sync |

Guide : **`deployment/DEPLOIEMENT-VPS-JOBSITEPRO.md`**
