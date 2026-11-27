# Bulletins PDF et courriel employé

## Télécharger en PDF

- **Paie** → bouton **Bulletins PDF** (tous les bulletins)
- Sur chaque bulletin : icône **PDF** (un seul employé)

## Créer un bulletin (patron)

1. **Simulateur** : employé + heures + taux → **Enregistrer bulletin** (brouillon)
2. Ou **Calculer** si vous avez des **pointages** (horloge) sur la période
3. Le bulletin apparaît dans **Période de paie** (liste par employé)

## Envoyer à l'employé

Quand vous **publiez** un bulletin (**Publier et envoyer** ou « Publier et envoyer tout ») :

1. Le statut passe à `sent`
2. Une **notification** apparaît dans l'app employé
3. Un **courriel** part si SMTP est configuré (voir ci-dessous)

Bouton **courriel** sur un bulletin déjà publié : renvoie le message.

## Configurer SMTP (obligatoire pour le courriel)

PocketBase Admin → **Settings** → **Mail settings**

- Serveur SMTP (Brevo, Gmail, hébergeur…)
- **Sender address** : `noreply@votredomaine.com`
- **Application URL** : `http://127.0.0.1:8888` (ou votre domaine)

Test : **Send test email**

## Hook PocketBase

Copier le dossier `pocketbase/pb_hooks/` vers le serveur à côté de PocketBase :

```
/opt/chantiertrack/pb_hooks/pay_stub_email.pb.js
```

Redémarrer PocketBase :

```bash
sudo systemctl restart chantiertrack
```

## Taux horaire

- À la **création / modification** d'un employé : champ **Taux horaire ($/h)**
- Enregistré dans `pay_rates` (utilisé par Calculer + simulateur)
- Liste **Taux horaires** à droite : modification rapide par employé
