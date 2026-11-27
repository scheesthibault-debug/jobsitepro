# JobsitePro Contact — Cloudflare Worker + Resend

Formulaire site → Worker → [Resend API](https://resend.com/docs/api-reference/emails/send-email) → `contact@example.com`

## Déploiement

```bash
cd jobsitepro-contact
npm install
wrangler login
wrangler secret put RESEND_API_KEY
wrangler deploy
```

Note l'URL affichée (ex. `https://jobsitepro-contact.xxx.workers.dev`).

## Frontend

Remplace `TONCOMPTE` dans :

- `site/index.html` → `<meta name="contact-api" content="...">`
- `site/contact.html` → même meta tag

Puis redéploie le site sur Cloudflare Pages.

## Resend — domaine jobsitepro.ca

1. [resend.com/domains](https://resend.com/domains) → ajouter `jobsitepro.ca`
2. Copier les enregistrements DNS (SPF, DKIM) dans Cloudflare DNS
3. Attendre vérification
4. L'expéditeur `noreply@jobsitepro.ca` fonctionnera

## Test

```bash
curl -X POST https://jobsitepro-contact.xxx.workers.dev \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"vous@exemple.com","message":"Bonjour JobsitePro"}'
```

Réponse attendue : `{"success":true}`

## Variables (wrangler.toml)

| Variable | Description |
|----------|-------------|
| `CONTACT_TO` | Boîte destinataire |
| `CONTACT_FROM` | Expéditeur (`noreply@jobsitepro.ca`) |
| `CONTACT_FROM_NAME` | Nom affiché |
| `SITE_URL` | Lien footer du courriel |
| `RESEND_API_KEY` | Secret Cloudflare (jamais en dur) |
