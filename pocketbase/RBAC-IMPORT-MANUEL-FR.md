# RBAC — import qui échoue (« unknown field company »)

## Pourquoi l'erreur

PocketBase valide la collection **users** et voit des règles API du type :

`company = @request.auth.company`

…mais le champ **`company`** n'existe pas (encore) sur **users** chez toi.  
L'import du champ `rbac_role` déclenche cette vérification → **échec**.

## Solution la plus simple (sans JSON)

### Étape 1 — Champ `company` sur users (si absent)

1. Admin PocketBase → **Collections** → **users**
2. **+ New field** → type **Relation**
3. Name : **`company`**
4. Collection : **companies**
5. **Save**

### Étape 2 — Champ `rbac_role`

1. Toujours sur **users** → **+ New field** → type **Select**
2. Name : **`rbac_role`**
3. Values (une par ligne) :

```
admin_patron
gestionnaire
comptable
contremaitre
securite_sst
employe
lecture_seule
```

4. **Save**

### Étape 3 — Ton compte

**users** → ton email → `rbac_role` = **admin_patron** et `role` = **admin**

### Étape 4 — Règle API « view » sur users (important pour le login)

Si le login patron affiche `role=—` ou bloque alors que PocketBase est correct :

1. **Collections** → **users** → icône engrenage → **API rules**
2. **View rule** (et **List rule**) — ajoutez l’accès à son propre enregistrement :

```
id = @request.auth.id || (@request.auth.id != "" && company = @request.auth.company)
```

3. **Save**

Sans cette règle, l’app ne peut pas recharger `role` / `rbac_role` après la connexion.

---

## Ré-import JSON (optionnel, après étape 1)

Quand le champ **company** existe, vous pouvez réessayer :

`rbac-only-import.json` en mode **Merge**

---

## Sans `rbac_role` en base

L'app fonctionne quand même en mode simple :

- `role` = **admin** → administrateur patron  
- `role` = **employe** → app mobile  

Le champ `rbac_role` sert pour **gestionnaire, comptable, sécurité SST**, etc.
