# Récupération du mot de passe par courriel (PocketBase)

Les apps **Patron** et **Employé** envoient une demande à PocketBase :
`POST /api/collections/users/request-password-reset`

Le lien dans le courriel doit ouvrir l’app avec le jeton, par exemple :
- Patron : `https://VOTRE-DOMAINE/patron/?resetToken=XXXX`
- Employé : `https://VOTRE-DOMAINE/employe/?resetToken=XXXX`

(Les deux apps utilisent le même compte `users` — un seul lien suffit pour réinitialiser le mot de passe.)

## 1. Configurer l’envoi de courriels (SMTP)

Dans l’admin PocketBase (`https://VOTRE-DOMAINE/_/`):

1. **Settings → Mail settings**
2. Renseigner le serveur SMTP (ex. Gmail, SendGrid, Brevo, courriel de votre hébergeur)
3. **Sender address** : adresse d’envoi (ex. `noreply@chantiertrack.ca`)
4. Enregistrer et utiliser **Send test email** pour vérifier

Sans SMTP, l’app affichera « Impossible d’envoyer le courriel ».

## 2. URL de l’application

**Settings → Application**

- **Application URL** : `https://jobsitepro.example.com` (votre domaine, sans slash final)

## 3. Modèle de courriel « Reset password »

**Settings → Mail templates → Password reset**

Remplacer le lien par défaut par un lien vers l’app employé ou patron, par exemple :

```html
<p>Bonjour,</p>
<p>Cliquez pour choisir un nouveau mot de passe ChantierTrack :</p>
<p><a href="{APP_URL}/employe/?resetToken={TOKEN}">Réinitialiser mon mot de passe</a></p>
<p>Ce lien expire après un court délai. Si vous n’avez pas demandé cette réinitialisation, ignorez ce message.</p>
```

Pour les patrons, vous pouvez utiliser `/patron/?resetToken={TOKEN}` à la place.

Variables PocketBase : `{APP_URL}`, `{TOKEN}`, `{EMAIL}`

## 4. Côté utilisateur

1. Écran de connexion → **Mot de passe oublié ?**
2. Saisir le **courriel du compte**
3. Ouvrir le lien reçu (vérifier les **indésirables**)
4. Saisir le **nouveau mot de passe** (8 caractères minimum)
5. Se reconnecter avec le nouveau mot de passe

## 5. Patron : réinitialiser un employé sans courriel

Dans l’app Patron → **Employés** → modifier l’employé → champ mot de passe (si proposé à la création) ou définir un mot de passe temporaire via l’admin PocketBase.

---

Après modification des fichiers `patron/index.html` et `employe/index.html`, redéployer et forcer le rafraîchissement / réinstaller la PWA.
