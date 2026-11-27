# Phases 1–2–3 — Implémentées (OCR Gemini)

## Phase 1 — Dépenses / Scan (Gemini)

- **OCR** : `services/receipt-ocr` — `OCR_PROVIDER=gemini` (chaîne par défaut : gemini → ocrspace, sans Claude)
- **Employé** : scan caméra/galerie → proxy → formulaire pré-rempli → `expenses` statut `pending` + notification admins
- **Patron** : page Dépenses (style Dext), filtres, totaux par catégorie (approuvées), modal **Modifier**, export **approuvées**, PDF/Excel
- **Realtime** : `patron/js/shared/pb-realtime-expenses.js` — toast + refresh à chaque nouvelle dépense

## Phase 2 — Soumissions

- **PDF** : `patron/js/soumissions/soumissions-pdf.js` — bouton PDF dans l’éditeur
- **Email** : `patron/js/soumissions/soumissions-actions.js` — mailto client + statut envoyé
- **Convertir en chantier** : crée `sites` + lie `soumission` + budgets MO/matériaux

## Phase 3 — Coûts chantier

- Budget depuis **soumission** liée si budget chantier vide
- Graphique Chart.js (existant)
- Alerte 80 % (existant)
- **Export PDF** : `patron/js/job-costing/job-cost-pdf.js`
- Lien **Coûts** sur chaque carte chantier (existant)

## Lancer en local

```powershell
# OCR Gemini
cd chantiertrack-v2/services/receipt-ocr
.\start-local.ps1

# Patron
cd chantiertrack-v2/patron
npx serve -p 8081

# Employé
cd chantiertrack-v2/employe
npx serve -p 8080
```

Vérifier `.env` : `OCR_PROVIDER=gemini` et `GOOGLE_AI_API_KEY=...`
