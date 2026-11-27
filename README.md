# JobsitePro

JobsitePro is a construction job-site management SaaS for small contractors in Canada (Quebec-focused).

It provides:

- **Employee PWA** — GPS clock-in/out, safety document signing before clock-in, photos, incidents, receipt scan
- **Manager (patron) PWA** — live map, timesheets, expenses approval, CRM/quotes/invoices (Knowify-style modules), job costing
- **Marketing site** — plans and contact form
- **Integrations** — QuickBooks Online OAuth + sync hub, Wagepoint hours export (CSV), receipt OCR (Gemini), email via Resend

This repository is a working product codebase, not a polished open-source framework. Some modules are MVP-level UI; deployment scripts target a self-hosted Linux server.

## Tech stack

| Layer | Technology |
|-------|------------|
| Apps | HTML + vanilla JS PWAs (`patron/`, `employe/`, `site/`) |
| Backend | PocketBase (auth, collections, JS hooks, files) |
| Services | Node.js microservices: `receipt-ocr`, `integrations-hub`, `contact-mail`, `push` |
| Integrations | QuickBooks Online, Resend, Google Gemini OCR |
| Deploy | Docker (PocketBase via Dockge), Nginx reverse proxy, shell install scripts |

## Architecture (short)

```
Browser PWAs (patron / employe / site)
        │
        ▼
   Nginx (:8888)
        ├── static apps
        ├── /api/           → PocketBase (:8091)
        ├── /ocr/           → receipt-ocr (:3101)
        ├── /integrations/  → integrations-hub (:3102)
        ├── /contact/       → contact-mail (:3103)
        └── /push/          → push (:3099)
```

PocketBase is the system of record. Hooks enforce rules such as “no safety signature → no clock-in” and handle OAuth redirects for QuickBooks.

## Plans (commercial model)

| Plan | PocketBase `companies.plan` | Includes |
|------|-----------------------------|----------|
| Standard | `basic` | GPS, clock, sites, SST docs, photos, incidents |
| Premium | `pro` | + receipt OCR, expenses, mileage |
| Elite | `enterprise` | + CRM, quotes, job costing, QuickBooks |

Pricing logic: fixed monthly fee + per active clocking employee (see `docs/PRODUITS-MODULES-FR.md`).

## Requirements

- Node.js 18+
- Docker (for PocketBase)
- Nginx (or another reverse proxy) for a full local/prod stack
- Optional: Resend API key, Google AI Studio key, Intuit QuickBooks app credentials

## Quick start (local)

### 1. PocketBase

```bash
# Example: run PocketBase with Docker (see deployment/dockge-*.compose.yaml)
docker compose -f deployment/dockge-chantiertrack-pb.compose.yaml up -d
```

Import collections from `pocketbase/` JSON files if starting from an empty database. Copy hooks into the PocketBase hooks directory as documented in `deployment/`.

### 2. Configure environment files

Copy examples and fill in real values (never commit real keys):

```bash
cp services/receipt-ocr/.env.example services/receipt-ocr/.env
cp services/contact-mail/.env.example services/contact-mail/.env
cp services/integrations-hub/.env.example services/integrations-hub/.env
```

See also `deployment/*.env.server` templates.

### 3. Start microservices

```bash
cd services/receipt-ocr && npm install && npm start
cd services/contact-mail && npm install && npm start
cd services/integrations-hub && npm install && npm run build && npm start
cd push && npm install && npm start
```

### 4. Serve the apps

Serve `patron/`, `employe/`, and `site/` behind Nginx, or with any static file server. Point the apps at your PocketBase URL (see `PROD_API_URL` in `patron/index.html` and `employe/index.html`).

Health checks:

```bash
curl http://127.0.0.1:8091/api/health
curl http://127.0.0.1:3101/health
curl http://127.0.0.1:3102/health
curl http://127.0.0.1:3103/health
```

## Configuration (environment)

| Variable | Service | Purpose |
|----------|---------|---------|
| `GOOGLE_AI_API_KEY` | receipt-ocr | Gemini OCR |
| `RESEND_API_KEY` | contact-mail | Transactional email |
| `CONTACT_TO` / `CONTACT_FROM` | contact-mail | Inbox / from address |
| `QUICKBOOKS_CLIENT_ID` / `SECRET` | PocketBase + hub | Intuit OAuth |
| `POCKETBASE_ADMIN_TOKEN` | integrations-hub | Admin API access |
| `INTEGRATIONS_SERVICE_SECRET` | integrations-hub | Service-to-service auth |
| `QUICKBOOKS_REDIRECT_URI` | PocketBase | Must match Intuit Developer portal |

Full server install notes: `deployment/GUIDE_INSTALLATION_SERVEUR.md` and `deployment/DEPLOIEMENT-VPS-JOBSITEPRO.md`.

## Known limits / next steps

- Frontend is large single-page HTML files; not a modern component framework
- Knowify/Dext-style modules are functional MVPs (inbox UI), not pixel clones of those products
- Stripe subscription billing is documented but not fully automated
- QuickBooks sync and domain migration need validation per environment
- Self-hosted ops (no managed PaaS out of the box); scripts assume a Linux host without full systemd sudo in some setups

## Security model

Multi-tenant isolation is enforced by PocketBase API rules (`company = @request.auth.company` + `@request.auth.is_active = true` on company-wide list/view) plus JS hooks (`pb_hooks/lib/security.js`) that block role escalation at signup, force public join accounts to `is_active = false`, and prevent self-modification of `role` / `rbac_role` / `company`. Payroll and expense rows are visible to the employee owner or to same-company admins (PB `role = "admin"`, which includes `comptable`).

Full model, before/after rule guidance, and production apply steps: **[SECURITY.md](SECURITY.md)**.

Automated checks (env-based, no secrets in repo):

```bash
export PB_URL="http://127.0.0.1:8091"
export PB_ADMIN_EMAIL="admin@example.com"
export PB_ADMIN_PASSWORD="..."
bash deployment/test-security.sh
```

## Security note

This public copy uses placeholder domains (`jobsitepro.example.com`) and fake credentials in examples. Never commit real keys.

## License

Source-available under the PolyForm Noncommercial License 1.0.0 (see LICENSE). You may view, study and test this code for noncommercial purposes. Commercial use, resale or hosting as a paid service is not permitted.

## Author

Built by Thibault Schees — TS Solution Tech Acadie (Kentville, Nova Scotia).

For commercial licensing or a demo, contact the author via GitHub.
