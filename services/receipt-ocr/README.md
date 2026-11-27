# Scan reçu JobsitePro (OCR)

Proxy serveur : l’employé envoie la photo, le serveur lit le reçu et renvoie fournisseur / montant / taxes.

## Option gratuite recommandée : Google Gemini

1. Ouvrir **https://aistudio.google.com/apikey**
2. Se connecter avec un compte Google
3. **Create API key** (gratuit — quotas pour PME)
4. Sur le serveur, fichier `/opt/chantiertrack/receipt-ocr/.env` :

```env
OCR_PROVIDER=gemini
GOOGLE_AI_API_KEY=AIzaSy...votre_cle
PORT=3101
POCKETBASE_URL=http://127.0.0.1:8090
REQUIRE_AUTH=true
```

5. Redémarrer :

```bash
sudo systemctl restart chantiertrack-ocr
curl http://127.0.0.1:3101/health
# → "gemini": true
```

## Option 100 % gratuite sans IA (texte seulement)

**OCR.space** — inscription gratuite sur https://ocr.space/ocrapi

```env
OCR_PROVIDER=ocrspace
OCR_SPACE_API_KEY=votre_cle_gratuite
```

Moins précis sur les montants (regex), mais aucune carte de crédit.

## Claude (payant)

```env
OCR_PROVIDER=claude
CLAUDE_API_KEY=sk-ant-...
```

## Install serveur

```bash
sudo bash deployment/install-receipt-ocr.sh
```

Nginx : `https://jobsitepro.example.com/ocr/scan-receipt`

## Extraction automatique (champs)

L’IA lit sur le reçu : **magasin**, **total TTC**, **TPS/TVQ**, sous-total HT, date, catégorie, n° facture.

Provider recommandé : **Gemini** (vision + JSON structuré).

## Important

- Crée **ta** clé sur https://aistudio.google.com/apikey (gratuit).
- Sans clé OCR configurée sur le serveur, le scan employé **échouera** (saisie urgence seulement).
- Vérifier : `curl https://jobsitepro.example.com/ocr/health` → `"gemini": true`
