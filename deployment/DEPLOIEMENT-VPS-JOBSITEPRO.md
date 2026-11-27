# Déploiement VPS / serveur JobsitePro

> Guide unique pour **jobsitepro.example.com** (serveur maison `127.0.0.1` ou VPS Linux).  
> Objectif : **5 services en 1 app** — QuickBooks, Wagepoint (export), QB Time, Knowify, reçus OCR — **sans** prototypes en double.

Voir aussi : `docs/ARCHITECTURE-5-SERVICES.md`

---

## 1. Ce que tu déploies (et ce que tu ignores)

### À copier sur le serveur

```
chantiertrack-v2/
├── patron/                 ✅ PWA patron (Knowify, dépenses, paie, QB)
├── employe/                ✅ PWA employé (pointage, scan reçu)
├── pocketbase/pb_hooks/    ✅ Hooks (OCR, OAuth, sync)
├── push/                   ✅ Notifications PWA
├── services/receipt-ocr/   ✅ Scan Gemini
├── services/integrations-hub/ ✅ QuickBooks OAuth + sync
└── deployment/             ✅ Scripts d’install
```

**Prototypes retirés du dépôt** (ne plus chercher sur la clé USB) : `receipts-hub/`, `platform/`, `payroll-gateway/`.

---

## 2. Architecture sur le serveur

| Service | Port local | URL publique (NPM) |
|---------|------------|-------------------|
| PocketBase | 8090 | `https://jobsitepro.example.com/` |
| Patron | (fichiers PB) | `.../patron/` |
| Employé | (fichiers PB) | `.../employe/` |
| Push | 3099 | `.../push/` |
| OCR reçus | 3101 | `.../ocr/` |
| Integrations hub | **3102** | `.../integrations/` (à ajouter NPM) |

**Pas de sous-domaine `admin.*`** pour le terrain — patron et employé sur le même domaine.

---

## 3. Installation initiale (VPS ou serveur (local))

### A. Prérequis

- Ubuntu 22.04+ (ou Debian)
- Node.js 20+, nginx, Docker (optionnel platform)
- Domaine + Nginx Proxy Manager (NPM) ou nginx + certbot

### B. Copier le projet

**Depuis Windows (réseau) :**

```
\\127.0.0.1\Stockage\chantiertrack-v2\chantiertrack-v2\
```

**Ou SCP vers VPS :**

```bash
scp -r chantiertrack-v2/ user@VOTRE_IP:/opt/chantiertrack-src/
```

### C. Installer la base (une fois)

```bash
cd /mnt/stockage/chantiertrack-v2/chantiertrack-v2
# ou cd /opt/chantiertrack-src/chantiertrack-v2

sudo bash deployment/install-serveur-local.sh
```

Crée : `/opt/chantiertrack/`, PocketBase, nginx:8888, services systemd.

### D. OCR Gemini (scan reçu)

```bash
sudo bash deployment/configure-gemini-ocr.sh "VOTRE_CLE_GOOGLE_AI"
# ou : sudo bash deployment/install-receipt-ocr.sh
```

Test :

```bash
curl -s http://127.0.0.1:3101/health
curl -s https://jobsitepro.example.com/ocr/health
```

### E. QuickBooks (integrations-hub)

```bash
sudo bash deployment/install-integrations-hub.sh
```

Éditer `/opt/chantiertrack/integrations-hub/.env` :

```env
PORT=3102
POCKETBASE_URL=http://127.0.0.1:8090
POCKETBASE_ADMIN_TOKEN=<token admin PocketBase>
INTEGRATIONS_SERVICE_SECRET=<secret long aléatoire>

QUICKBOOKS_CLIENT_ID=<Intuit Developer>
QUICKBOOKS_CLIENT_SECRET=<secret>
QUICKBOOKS_REDIRECT_URI=https://jobsitepro.example.com/api/jobsitepro/oauth/quickbooks/callback
QUICKBOOKS_ENVIRONMENT=sandbox
```

Redémarrer :

```bash
sudo systemctl restart jobsitepro-integrations
curl -s http://127.0.0.1:3102/health
```

### F. PocketBase — collections intégrations

Admin `https://jobsitepro.example.com/_/` :

1. Importer `pocketbase/integration_collections.json` (merge)
2. Copier hooks : `pocketbase/pb_hooks/*.pb.js` → `pb_data/pb_hooks/`
3. Redémarrer : `sudo systemctl restart chantiertrack`

Champs dépenses / soumissions : voir `pocketbase/PB_SCHEMA_CHANGELOG.md`

---

## 4. Nginx Proxy Manager (NPM)

Proxy host **jobsitepro.example.com** → `127.0.0.1:8888` (ou 8090 selon config).

**Custom locations obligatoires :**

| Location | Forward |
|----------|---------|
| `/ocr/` | `http://127.0.0.1:8888/ocr/` ou `:3101/` |
| `/push/` | `http://127.0.0.1:3099/` |
| `/integrations/` | `http://127.0.0.1:3102/` |

SSL : Let's Encrypt sur le domaine principal.

---

## 5. Mise à jour (copier-coller depuis ton PC)

### Windows → serveur

```powershell
cd <project-dir>
.\deployment\sync-patron-vers-serveur.ps1
.\deployment\sync-employe-vers-serveur.ps1
```

Ou copie manuelle vers `\\127.0.0.1\Stockage\...` puis sur le serveur :

```bash
cd /mnt/stockage/chantiertrack-v2/chantiertrack-v2
sudo bash deployment/mise-a-jour-jobsitepro.sh
```

### Après mise à jour services Node

```bash
sudo systemctl restart chantiertrack chantiertrack-ocr chantiertrack-push jobsitepro-integrations
```

**Ne jamais écraser** `/opt/chantiertrack/pb_data/` (données prod).

---

## 6. Utilisation terrain (ex-patron)

| Qui | URL | Action |
|-----|-----|--------|
| Employé | `https://jobsitepro.example.com/employe/` | Pointage, scanner reçu |
| Patron (GSM) | **Même URL employé** avec son login | Voir dépenses, approuver |
| Patron (bureau) | `.../patron/` | CRM, coûts, paie, QuickBooks |

### Les 5 services — où cliquer

| Service | Dans l’app |
|---------|------------|
| QuickBooks | Patron → QuickBooks → Connecter (OAuth) |
| Wagepoint | Patron → Paie → Export Excel heures → importer dans Wagepoint |
| QB Time | Employé → pointer ; Patron → Pointages |
| Knowify | Patron → Clients, Soumissions, Coûts chantier, Factures |
| Reçus (Dext) | Employé → Dépense → Scanner ; Patron → Dépenses |

---

## 8. VPS cloud (migration depuis serveur maison)

Même scripts ; changer l’IP dans NPM.

```bash
# Sur le NUC / serveur actuel — backup
sudo tar -czf pb_backup_$(date +%Y%m%d).tar.gz -C /opt/chantiertrack pb_data/

# Transfert vers VPS
scp pb_backup_*.tar.gz root@IP_VPS:/opt/chantiertrack/

# Sur VPS
sudo tar -xzf pb_backup_*.tar.gz -C /opt/chantiertrack/
sudo bash deployment/install-serveur-local.sh
sudo bash deployment/configure-gemini-ocr.sh "CLE"
sudo bash deployment/install-integrations-hub.sh
sudo systemctl restart chantiertrack
```

Ou script tout-en-un futur : `deployment/deploy-vps.sh` (PocketBase + nginx SSL).

---

## 9. Vérification finale

```bash
curl -s https://jobsitepro.example.com/patron/ | head -1
curl -s https://jobsitepro.example.com/ocr/health
curl -s https://jobsitepro.example.com/push/health
curl -s http://127.0.0.1:3102/health
sudo systemctl status chantiertrack chantiertrack-ocr chantiertrack-push jobsitepro-integrations
```

---

## 10. Dépannage rapide

| Symptôme | Fichier / commande |
|----------|-------------------|
| Scan OCR 404 | `ACTIVER-SCAN-IA.txt`, `deployment/NPM-OCR-404.md` |
| Hub QB indisponible | `journalctl -u jobsitepro-integrations -n 30` |
| Login patron KO | `deployment/FIX-LOGIN-8091.md` |
| Collections manquantes | `deployment/IMPORT-SCHEMA-ETAPE-PAR-ETAPE.md` |

---

*JobsitePro — une app, PocketBase au centre, compta externe via QuickBooks + export paie.*
