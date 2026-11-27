# PocketBase — scan reçus (ce qu’il faut vérifier)

## Bonne nouvelle : ton export `pb_schema (3).json` est déjà presque bon

La collection **`expenses`** contient déjà tout ce qu’il faut pour le scan Gemini :

| Champ | Présent ? | Rôle |
|-------|-----------|------|
| `receipt` | ✅ | Photo/PDF du ticket |
| `vendor` | ✅ | Magasin (OCR) |
| `amount` | ✅ | Total TTC |
| `tax_amount` | ✅ | Taxes |
| `expense_date` | ✅ | Date |
| `ocr_raw` | ✅ | JSON brut OCR |
| `ocr_confidence` | ✅ | `high` / `low` / `manual` |
| `fuel_type`, `license_plate`, `odometer_km` | ✅ | Essence camion |
| `employee_note`, `manager_note` | ✅ | Notes |

### Seul champ manquant (recommandé)

Ajoute **`payment_method`** dans PocketBase Admin → Collections → **expenses** → New field :

- **Type** : Select (single)
- **Name** : `payment_method`
- **Values** :
  - `unpaid`
  - `company_card`
  - `employee_pocket`

> Sans ce champ, l’app fonctionne quand même (fallback automatique), mais le mode de paiement ne sera pas enregistré proprement.

---

## Tu n’as PAS besoin de réimporter tout le schéma

Ne remplace pas toute la base avec le JSON — tu perdrais tes données.

**À faire seulement** : ajouter `payment_method` à la main (1 champ).

---

## Le scan ne marche pas à cause du hook, pas du schéma

Sur ton serveur, Gemini local **3101 = OK**, mais :

```
Hook local PB: ECHEC
Public HTTPS: FAIL
```

### 1. Vérifier que le hook est chargé

```bash
ls -la /opt/chantiertrack/pb_hooks/receipt_ocr_proxy.pb.js
curl -s http://127.0.0.1:8090/api/jobsitepro/ocr-health
```

Si **404** → PocketBase ne charge pas les hooks.

**Fix :**

```bash
sudo mkdir -p /opt/chantiertrack/pb_data/pb_hooks
sudo cp /opt/chantiertrack/pb_hooks/receipt_ocr_proxy.pb.js /opt/chantiertrack/pb_data/pb_hooks/ 2>/dev/null || \
sudo cp /mnt/stockage/chantiertrack-v2/chantiertrack-v2/pocketbase/pb_hooks/receipt_ocr_proxy.pb.js /opt/chantiertrack/pb_data/pb_hooks/

sudo systemctl restart chantiertrack
sleep 3
curl -s http://127.0.0.1:8090/api/jobsitepro/ocr-health
```

Réponse attendue : `"ok":true` et `"gemini":true`.

### 2. Règles API `expenses` (vérifier dans Admin)

Doivent être :

| Règle | Valeur |
|-------|--------|
| **List** | `employee = @request.auth.id \|\| company = @request.auth.company` |
| **View** | idem |
| **Create** | `employee = @request.auth.id` |
| **Update** | `@request.auth.role = "admin"` |

Ton export a déjà ces règles — **ne change rien** si c’est identique.

### 3. Fichier `receipt` — types MIME

Vérifie que `receipt` accepte :

- `image/jpeg`, `image/png`, `image/webp`, `image/heic`
- `application/pdf`

C’est déjà le cas dans ton schéma.

---

## Test complet après fix

```bash
# 1. OCR Gemini
curl -s http://127.0.0.1:3101/health

# 2. Hook PocketBase
curl -s http://127.0.0.1:8090/api/jobsitepro/ocr-health

# 3. Public (NPM)
curl -s https://jobsitepro.example.com/api/jobsitepro/ocr-health
```

Sur le téléphone : fermer l’app employé complètement, rouvrir, **Scanner un reçu**.

---

## Résumé

| Action | Obligatoire ? |
|--------|----------------|
| Ajouter champ `payment_method` | Recommandé |
| Réimporter `pb_schema (3).json` | **Non** |
| Copier hook + redémarrer PocketBase | **Oui** (pour corriger ECHEC hook) |
| Configurer NPM / HTTPS | Oui pour le téléphone hors LAN |
