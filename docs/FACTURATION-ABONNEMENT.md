# JobsitePro — Facturation abonnement (59 $ + 8 $/employé)

## Formule

```
Total / mois = forfait fixe (selon plan) + 8 $ × employés terrain actifs
```

| Plan | Fixe | + / employé | Ex. 10 emp. |
|------|------|-------------|-------------|
| Standard (`basic`) | 59 $ | 8 $ | 139 $ |
| Premium (`pro`) | 79 $ | 8 $ | 159 $ |
| Élite (`enterprise`) | 139 $ | 8 $ | 219 $ |

**Comptés :** comptes `employé` actifs (`is_active = true`, hors patron admin).  
**Recommandé facturation :** nombre d’employés actifs **en fin de mois** (simple). Prorata possible plus tard avec Stripe.

---

## 3 approches (du plus simple au plus auto)

### Option A — Manuel (maintenant, essai ex-patron)

| Étape | Qui |
|-------|-----|
| Client s’inscrit sur `/patron/?register=1&plan=standard` | Auto |
| `trial_ends` = +30 jours, `is_active = true` | Auto |
| Tu reçois un **courriel** (hook → n8n → Resend) | Auto notification |
| Tu actives / factures à la main (virement, Interac) | Toi |
| Fin d’essai : tu mets `is_active = false` dans PocketBase si pas payé | Toi |

**Pour :** zéro Stripe, démo rapide.  
**Contre :** tu dois surveiller ta boîte mail.

---

### Option B — n8n / webhook (recommandé phase 2)

```
Inscription PocketBase
        ↓
Hook PB → POST webhook n8n
        ↓
n8n : courriel admin + Google Sheet + rappel J-7 fin essai
        ↓
Toi : lien paiement manuel OU bouton « Activer » dans Sheet
        ↓
PocketBase : is_active = true
```

**Pour :** automatisé sans coder Stripe tout de suite.  
**Contre :** n8n doit tourner (tu as déjà Docker sur le serveur).

Fichier hook : `pocketbase/pb_hooks/company_signup_notify.pb.js`  
Variable : `JOBSITEPRO_SIGNUP_WEBHOOK_URL` (URL n8n).

---

### Option C — Stripe + webhook (phase 3)

```
Fin essai OU inscription payante
        ↓
Stripe Checkout (59 $ + quantité employés)
        ↓
Webhook Stripe → n8n ou service Node
        ↓
PocketBase : stripe_customer_id, is_active = true
```

**Pour :** paiement carte automatique.  
**Contre :** plus de dev + compte Stripe Canada.

Champ PB déjà prêt : `companies.stripe_customer_id`.

---

## Recommandation pour toi

| Phase | Quand | Quoi |
|-------|-------|------|
| **1** | Maintenant (essai ex-patron) | Hook → n8n → mail admin. **Pas de blocage** pendant 30 jours. |
| **2** | Après essai | Patron bloqué si `trial_ends` passé ET pas payé. Message + `info@jobsitepro.ca`. |
| **3** | Quand tu veux scale | Stripe Checkout + webhook. |

**Ne bloque pas à l’inscription** pendant la démo — sinon ton ex-patron ne peut pas tester.

---

## Champs PocketBase (`companies`)

| Champ | Usage |
|-------|--------|
| `plan` | `basic` / `pro` / `enterprise` |
| `trial_ends` | Fin essai 30 jours |
| `is_active` | `false` = accès patron coupé |
| `stripe_customer_id` | Stripe (plus tard) |
| `max_employees` | Optionnel : plafond si tu veux bloquer ajout employés |

---

## Workflow n8n (exemple)

**Webhook** `POST /webhook/jobsitepro-signup`

Payload reçu :
```json
{
  "event": "company_signup",
  "company": { "id", "name", "plan", "trial_ends", "province" },
  "patron": { "name", "email" }
}
```

Workflow n8n :
1. **Email** → `contact@example.com` — « Nouvelle entreprise JobsitePro »
2. **Google Sheets** — ligne avec date, nom, plan, email, trial_ends
3. **Schedule** (optionnel) — 7 jours avant `trial_ends` → rappel à toi + client
4. **Manuel** — tu coches « Payé » → HTTP PATCH PocketBase `is_active=true`

---

## Blocage app patron (phase 2 — à coder)

Dans `patron/index.html` au login :

```
Si company.is_active === false
  → écran « Abonnement inactif — contactez-nous »

Si trial_ends < aujourd'hui ET pas stripe_customer_id
  → même écran + « Essai terminé »
```

Employé : peut rester bloqué aussi si entreprise inactive.

---

## Prix quand employés changent dans le mois

**Règle simple (phase manuelle) :**  
À la fin du mois, tu comptes les employés actifs dans PocketBase → tu factures `59 + 8 × N`.

**Exemple :** 5 emp. début mois, +5 mi-mois → facture du mois = **10 employés = 139 $** (ou prorata si tu veux être plus fin avec Stripe).

---

## Fichiers liés

| Fichier | Rôle |
|---------|------|
| `pocketbase/pb_hooks/company_signup_notify.pb.js` | Webhook inscription |
| `services/contact-mail/` | Resend (contact site + peut servir pour mails n8n) |
| `docs/PRODUITS-MODULES-FR.md` | Tarifs et forfaits |

---

## Config serveur (hook)

Dans l’environnement PocketBase (systemd ou `.env` Docker) :

```bash
JOBSITEPRO_SIGNUP_WEBHOOK_URL=https://n8n.tondomaine.com/webhook/jobsitepro-signup
JOBSITEPRO_ADMIN_EMAIL=contact@example.com
```

Redémarrer PocketBase après ajout du hook.
