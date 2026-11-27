# URGENT — Scan OCR 404 sur https://jobsitepro.example.com

## Diagnostic (confirmé)

| URL publique | Résultat |
|--------------|----------|
| `/employe/` | 200 OK |
| `/patron/` | 200 OK |
| `/api/health` | 200 OK |
| **`/ocr/health`** | **404** |
| **`/push/health`** | **404** |

→ Nginx Proxy Manager envoie le site vers **PocketBase (8090)** ou un proxy **sans** `/ocr/`.  
Le scan IA est sur **Nginx port 8888**, pas sur PocketBase seul.

Sur le serveur, `http://127.0.0.1:8888/ocr/health` fonctionne (`gemini:true`).

---

## Solution A (recommandée) — Changer le port du proxy

1. Ouvrir **Nginx Proxy Manager**
2. **Proxy Hosts** → crayon sur `jobsitepro.example.com`
3. Onglet **Details** :
   - Forward Hostname : `127.0.0.1`
   - Forward Port : **`8888`** (pas 8090)
   - Scheme : `http`
4. Sauvegarder
5. Tester : `curl -s https://jobsitepro.example.com/ocr/health`  
   → doit afficher `"gemini":true`

---

## Solution B — Garder 8090 + ajouter locations OCR

Si le port principal doit rester **8090** :

1. Même proxy host → onglet **Custom locations**
2. **Add location** :
   - Location : `/api/jobsitepro/`
   - Forward : `127.0.0.1` port **`8888`**
   - Forward path : `/api/jobsitepro/`
3. **Add location** :
   - Location : `/ocr/`
   - Forward : `127.0.0.1` port **`8888`**
   - Forward path : `/ocr/`
4. **Add location** :
   - Location : `/push/`
   - Forward : `127.0.0.1` port **`8888`**
   - Forward path : `/push/`
5. Sauvegarder et retester :
   - `curl -s https://jobsitepro.example.com/api/jobsitepro/ocr-health`
   - `curl -s https://jobsitepro.example.com/ocr/health`

---

## Solution C — Config avancée NPM (si les locations ne marchent pas)

Onglet **Advanced** du proxy host, coller :

```nginx
location /api/jobsitepro/ {
    proxy_pass http://127.0.0.1:8888/api/jobsitepro/;
    proxy_set_header Host $host;
    proxy_read_timeout 120s;
    client_max_body_size 20M;
}
location /ocr/ {
    proxy_pass http://127.0.0.1:8888/ocr/;
    proxy_set_header Host $host;
    proxy_read_timeout 120s;
    client_max_body_size 20M;
}
location /push/ {
    proxy_pass http://127.0.0.1:8888/push/;
    proxy_set_header Host $host;
}
```

---

## Connexion en local (127.0.0.1:8888)

- URL : `http://127.0.0.1:8888/employe/`
- **Ne pas** mettre l’URL API sur `https://…` depuis une page `http://…` (bloqué par le navigateur).
- Utilisez l’URL locale telle quelle, **même email/mot de passe** que en ligne.
- Si échec : sur le serveur  
  `curl -s -X POST http://127.0.0.1:8888/api/collections/users/auth-with-password -H 'Content-Type: application/json' -d '{"identity":"VOTRE@EMAIL","password":"VOTRE_MDP"}'`

---

## SSL

Si le proxy est en **HTTP Only**, activez **Let's Encrypt** pour que `https://` fonctionne partout.
