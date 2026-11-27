# JobsitePro — Formulaire contact & courriel

Formulaire « Demande d'information » sur le site marketing → courriel HTML vers **contact@example.com** (configurable).

## Architecture

| Composant | Rôle |
|-----------|------|
| `site/index.html` + `site/js/contact-form.js` | Modal (style sombre JobsitePro) |
| `services/contact-mail/` | API Node + nodemailer |
| Nginx `/contact/` | Proxy vers port **3103** |

## Courriel reçu

- **Objet :** `Demande de contact — {Nom}`
- **Reply-to :** courriel du visiteur
- **De :** `JobsitePro <noreply@votre-domaine>`
- **Corps :** même mise en page que TS Solution Tech Acadie (en-tête sombre, champs NOM / COURRIEL / MESSAGE)

## Installation serveur

```bash
cd /mnt/stockage/chantiertrack-v2/chantiertrack-v2
sudo bash deployment/install-contact-mail.sh
```

Éditer `services/contact-mail/.env` :

```env
CONTACT_TO=contact@example.com
CONTACT_FROM=noreply@jobsitepro.ca
CONTACT_FROM_NAME=JobsitePro
CONTACT_SITE_LABEL=jobsitepro.example.com

SMTP_HOST=send.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASS=votre_mot_de_passe
```

Redémarrer :

```bash
sudo systemctl restart jobsitepro-contact-mail
curl -s http://127.0.0.1:3103/health
```

## Nginx Proxy Manager

Nouvelle location sur `jobsitepro.example.com` :

- **Path :** `/contact`
- **Forward :** `http://127.0.0.1:3103`

## Associer le domaine JobsitePro au courriel

1. Créer `noreply@jobsitepro.ca` chez votre hébergeur
2. Configurer **SPF**, **DKIM**, **DMARC**
3. Renseigner SMTP dans `.env`

En attendant, réutilisez le SMTP existant (`example.com`) avec `CONTACT_FROM_NAME=JobsitePro`.

## Test local

```bash
cd services/contact-mail
cp .env.example .env
npm install
npm start
```
