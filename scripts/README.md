# Scripts utilitaires

## Logos (patron + employé)

Les icônes sont déjà dans `patron/` et `employe/` (`icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `logo-banner.png`).

Pour les regénérer **sans npm** (recommandé sur Windows) :

```powershell
cd chantiertrack-v2\scripts
.\generate-logos.ps1 -Source "C:\chemin\vers\votre-logo.png"
```

## Dossier `node_modules` (optionnel)

Le script `generate-logos.mjs` utilise `sharp` et crée un dossier `node_modules` lourd avec des DLL (`libvips`).

- **Vous pouvez supprimer tout le dossier `scripts\node_modules`** — l’application ChantierTrack n’en a pas besoin.
- Si Windows affiche « Élément introuvable » en déplaçant le projet : cliquez **Ignorer** ou supprimez `scripts\node_modules` à la main.

Ne commitez pas `node_modules` (déjà dans `.gitignore` ici).
