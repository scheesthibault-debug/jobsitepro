# Suppression photos après archive (PocketBase)

Pour que les photos/reçus soient retirés du serveur après l’archive ZIP, le compte **patron** doit avoir le rôle **`admin`** et la collection **`photos`** doit autoriser :

| Règle | Valeur recommandée |
|--------|-------------------|
| **deleteRule** | `@request.auth.role = "admin"` |
| **updateRule** | `@request.auth.role = "admin"` |

Collection **`expenses`** :

| Règle | Valeur |
|--------|--------|
| **updateRule** | `@request.auth.role = "admin"` |

Sans ces règles, l’archive ZIP fonctionne mais les fichiers restent sur le serveur (message d’échec dans l’app).

## Compte patron

Dans **Collections → users → votre courriel**, le champ **`role`** doit être exactement :

```text
admin
```

(`admin` en minuscules — le code accepte aussi `patron` mais PocketBase exige en général `admin` dans deleteRule).

## ZIP archive

- `donnees_csv/` — fichiers Excel
- `rapports_pdf/` — rapports PDF
- `photos_chantier/` — images chantier
- `recus_depenses/` — photos/PDF des reçus de dépenses

L’app supprime maintenant **l’enregistrement photo entier** (la carte disparaît de Travaux / Problème / Photos), pas seulement le fichier sur le disque.
