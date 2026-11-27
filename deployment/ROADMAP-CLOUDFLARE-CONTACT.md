# Roadmap — Contact via Cloudflare (plus tard)

**Statut actuel :** formulaire contact → **serveur (local)** (`services/contact-mail` port 3103 + Resend).

**Objectif futur :** même modèle que TS Solution Tech Acadie — Cloudflare Worker + Resend, site sur Cloudflare Pages (`jobsitepro.ca`).

## Déjà prêt dans le repo

| Élément | Chemin |
|---------|--------|
| Worker Cloudflare | `jobsitepro-contact/` |
| Site vitrine | `site/` |
| Bascule frontend | ajouter `<meta name="contact-api" content="https://jobsitepro-contact.xxx.workers.dev">` dans `site/index.html` et `site/contact.html` |

Le JS (`site/js/contact-form.js`) utilise le serveur par défaut (`/contact/api/send`) et bascule sur le Worker si la meta `contact-api` est définie.

## Quand migrer

1. Déployer Worker depuis **Windows** : `cd jobsitepro-contact && npx wrangler deploy`
2. Valider `jobsitepro.ca` dans Resend (DNS Cloudflare)
3. Créer projet Cloudflare Pages → upload `site/`
4. Ajouter meta `contact-api` avec l'URL Worker
5. Arrêter `contact-mail` sur le serveur (optionnel)

## Ne pas faire sur le serveur

- `npm install` dans `jobsitepro-contact/` (Wrangler = PC uniquement)
- Cloudflare Worker ne tourne pas sur le serveur Linux

Voir aussi : `jobsitepro-contact/README.md`
