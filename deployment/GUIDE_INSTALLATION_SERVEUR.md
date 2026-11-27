# JobsitePro — Installation sur ton serveur (copier-coller déjà fait)

Serveur LAN : **127.0.0.1** · utilisateur **titi**  
Prod : **https://jobsitepro.example.com**

---

## Étape A — Connexion SSH

**Windows PowerShell :**

```powershell
ssh user@127.0.0.1
```

*(Ou l’utilisateur de ton VPS prod.)*

---

## Étape B — Aller dans le projet copié

```bash
# Si copié sur la clé USB / stockage :
cp -r /mnt/stockage/chantiertrack-v2/chantiertrack-v2 ~/chantiertrack-v2

cd ~/chantiertrack-v2
ls deployment/
```

Tu dois voir : `install-serveur-local.sh`, `mise-a-jour-jobsitepro.sh`, `configure-gemini-ocr.sh`

---

## Étape C — Première install OU mise à jour ?

### Cas 1 : JobsitePro **jamais** installé sur ce serveur

```bash
cd ~/chantiertrack-v2
sudo bash deployment/install-serveur-local.sh
```

→ Installe PocketBase, Nginx, patron, employé, push, OCR.

### Cas 2 : JobsitePro **déjà** en ligne (ton cas probable)

**Ne pas** réinstaller tout — ça garde tes données :

```bash
cd ~/chantiertrack-v2
sudo bash deployment/mise-a-jour-jobsitepro.sh
```

---

## Étape D — Clé API scan reçu (Gemini, gratuit)

### 1. Créer la clé (sur ton PC, 2 min)

1. https://aistudio.google.com/apikey  
2. **Create API key**  
3. Copier la clé (`AIzaSy...`)

### 2. La mettre sur le serveur

```bash
cd ~/chantiertrack-v2
sudo bash deployment/configure-gemini-ocr.sh
```

Coller la clé quand demandé.

**Ou en une ligne :**

```bash
sudo bash deployment/configure-gemini-ocr.sh "AIzaSy_VOTRE_CLE_ICI"
```

### 3. Vérifier

```bash
curl http://127.0.0.1:3101/health
```

Réponse attendue : `"gemini":true`

Depuis ton PC (même réseau) :

```bash
curl http://127.0.0.1/ocr/health
```

---

## Étape E — PocketBase (champs pour Dext + Soumissions)

1. Ouvrir **http://127.0.0.1/_/** (ou ton domaine prod)  
2. Admin → Collections  

**Collection `expenses`** — ajouter si manquants :

| Champ | Type |
|-------|------|
| vendor | Text |
| tax_amount | Number |
| employee_note | Text |
| manager_note | Text |
| ocr_raw | JSON |
| ocr_confidence | Select : high, low, manual |

**`receipt`** : autoriser PDF + images.

**Collection `notifications`** :

- Règle **Create** : `@request.auth.id != "" && company = @request.auth.company`
- Type `expense` dans la liste

**Collection `soumissions`** : importer ou créer (voir `pocketbase/pb_schema (2).json`)

Détail : `pocketbase/PB_SCHEMA_CHANGELOG.md`

---

## Étape F — Sync depuis ton PC Windows (optionnel)

Si tu modifies le code sur le PC :

```powershell
cd <project-dir>

# Copier tout le projet sur le serveur (1 fois)
scp -r deployment patron employe services user@127.0.0.1:~/chantiertrack-v2/

# Ou seulement patron + employé
.\deployment\sync-patron-vers-serveur.ps1 -Server "user@127.0.0.1"
.\deployment\sync-employe-vers-serveur.ps1 -Server "user@127.0.0.1"
```

Puis sur le serveur :

```bash
sudo bash deployment/mise-a-jour-jobsitepro.sh
sudo bash deployment/configure-gemini-ocr.sh "AIzaSy..."
```

---

## Étape G — Test complet

| Test | URL |
|------|-----|
| Patron | http://127.0.0.1/patron/ |
| Employé | http://127.0.0.1/employe/ |
| OCR | `curl http://127.0.0.1/ocr/health` |
| Push | `curl http://127.0.0.1/push/health` |

1. Employé : Dépense → photo reçu → champs remplis  
2. Patron : Dépenses → approuver  
3. Patron : Coûts chantier → montant visible  

---

## Prod jobsitepro.example.com

Même scripts, mais :

```bash
# POCKETBASE_URL reste http://127.0.0.1:8090 (interne)
sudo bash deployment/configure-gemini-ocr.sh "AIzaSy..."

# Nginx prod : vérifier bloc location /ocr/ (comme /push/)
sudo nginx -t && sudo systemctl reload nginx
```

Sync Windows :

```powershell
.\deployment\sync-patron-vers-serveur.ps1 -Server "USER@jobsitepro.example.com"
.\deployment\sync-employe-vers-serveur.ps1 -Server "USER@jobsitepro.example.com"
```

---

## Dépannage

| Problème | Solution |
|----------|----------|
| **Port 80 = docker-proxy** | Ne pas arrêter Docker si n8n/autre tourne : `sudo bash deployment/fix-nginx-port8080.sh` puis URLs `:8080` |
| Scan ne remplit rien | `curl .../ocr/health` → gemini false → refaire configure-gemini-ocr |
| 401 scan | Employé doit être connecté (token PocketBase) |
| Dépenses vides côté patron | Champs `vendor` manquants dans PB |
| install script absent | `scp deployment/*.sh user@127.0.0.1:~/chantiertrack-v2/deployment/` |

### Docker occupe le port 80

```bash
docker ps --format "table {{.Names}}\t{{.Ports}}"
sudo bash deployment/fix-nginx-port8080.sh
```

URL API dans les apps : `http://127.0.0.1:8080`

---

*Envoie-moi la sortie de `curl http://127.0.0.1:3101/health` si quelque chose bloque.*
