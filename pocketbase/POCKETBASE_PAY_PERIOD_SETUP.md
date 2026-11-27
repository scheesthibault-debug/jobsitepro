# PocketBase — Période de paie sur `companies`

L’erreur **« Invalid collections configuration »** apparaît si vous collez `companies_pay_period_fields.json` dans **Import collections**. Ce fichier est une **liste de champs à créer à la main**, pas un export PocketBase.

## Méthode recommandée (2 minutes, sans import)

### 1. Ajouter les champs

1. Ouvrez **PocketBase Admin** → **Collections** → **companies**
2. **New field** :
   - Name : `pay_period_start` → Type : **Date** → Required : non → Save
3. **New field** :
   - Name : `pay_period_end` → Type : **Date** → Required : non → Save

### 2. Permettre aux employés de lire la période

1. Toujours sur **companies** → onglet **API Rules**
2. Pour **List rule** et **View rule**, ajoutez (ou combinez avec vos règles admin) :

```txt
@request.auth.id != "" && id = @request.auth.company
```

Si les patrons doivent tout voir et les employés seulement leur entreprise, exemple combiné :

```txt
@request.auth.role = "admin" || (@request.auth.id != "" && id = @request.auth.company)
```

Adaptez selon vos rôles réels (`admin`, `employe`, etc.).

### 3. Vérifier dans ChantierTrack

1. **Patron** → **Paie** → choisissez les dates (ex. 15 mai → 28 mai)
2. Changez une date ou rouvrez la page (la période est enregistrée sur `companies`)
3. **Employé** (compte avec des pointages, ex. fred) → **Ma paie** → rechargement (Ctrl+F5)

Les heures et le brut/net approximatifs doivent correspondre au patron.

---

## Méthode « Import collections » (avancée)

Utilisez **Import** seulement avec un JSON exporté par **votre** PocketBase :

1. **Settings** → **Export collections** → téléchargez le JSON
2. Ouvrez le fichier, trouvez la collection `"name": "companies"`
3. Dans `"fields"` (ou `"schema"` selon la version), ajoutez :

```json
{
  "name": "pay_period_start",
  "type": "date",
  "required": false
},
{
  "name": "pay_period_end",
  "type": "date",
  "required": false
}
```

4. **Import collections** → collez **tout** le JSON exporté modifié → **Review** → confirmer

Ne importez jamais un fichier partiel qui ne contient que `companies` sans les autres collections, sauf si PocketBase vous montre clairement un aperçu de fusion sans suppression de données.

---

## Dépannage

| Symptôme | Cause probable | Action |
|----------|----------------|--------|
| Import invalide | JSON = note, pas export PB | Méthode manuelle ci-dessus |
| Employé 0 h, patron OK | Période différente ou règles `companies` | Champs + règles API + reconnecter employé |
| PATCH période échoue (patron) | Champs absents | Créer `pay_period_start` / `pay_period_end` |
