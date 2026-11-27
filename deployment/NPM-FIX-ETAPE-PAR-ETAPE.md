# Fix NPM — scan OCR (5 minutes)

Le serveur est **bon** (`8888` → Gemini OK).  
Le téléphone utilise **HTTPS public** → NPM envoie encore vers le port **8090** (PocketBase seul) → **404**.

Preuve :
- `https://jobsitepro.example.com/api/health` → **200** ✅
- `https://jobsitepro.example.com/api/jobsitepro/ocr-health` → **404** ❌

---

## Solution la plus simple (recommandée)

### Dans Nginx Proxy Manager (NPM)

1. Ouvrir NPM dans le navigateur (souvent `http://IP-DU-NPM:81`)
2. Menu **Hosts** → **Proxy Hosts**
3. Cliquer le **crayon ✏️** sur `jobsitepro.example.com`
4. Onglet **Details** :

| Champ | Avant (mauvais) | Après (bon) |
|-------|-----------------|-------------|
| Domain Names | jobsitepro.example.com | (inchangé) |
| Scheme | http | http |
| Forward Hostname / IP | 127.0.0.1 | 127.0.0.1 |
| Forward Port | **8090** | **8888** |
| Cache Assets | off | off |
| Block Common Exploits | on | on |
| Websockets Support | on | on |

5. **Save**

6. Attendre 10 secondes, puis tester (navigateur ou serveur) :

```
https://jobsitepro.example.com/api/jobsitepro/ocr-health
```

**Doit afficher :** `"gemini":true`

7. Sur le **téléphone** :
   - Fermer complètement l’app employé
   - Rouvrir `https://jobsitepro.example.com/employe/`
   - Rescanner un reçu

---

## Si tu ne peux pas changer le port 8090 → 8888

Onglet **Custom locations** du même proxy host, ajouter **3 locations** :

### Location 1 (scan — important)
- Location : `/api/jobsitepro`
- Scheme : `http`
- Forward Hostname : `127.0.0.1`
- Forward Port : `8888`
- Forward Path : `/api/jobsitepro`

### Location 2 (ocr legacy)
- Location : `/ocr`
- Port : `8888`
- Forward Path : `/ocr`

### Location 3 (push)
- Location : `/push`
- Port : `8888`
- Forward Path : `/push`

Save → retester l’URL ci-dessus.

---

## Solution C — Onglet Advanced (si Custom locations ne marche pas)

Coller dans **Advanced** :

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
```

---

## Contournement immédiat (Wi‑Fi maison, sans NPM)

Sur le téléphone **connecté au même Wi‑Fi** que le serveur :

```
http://127.0.0.1:8888/employe/
```

(même login/mot de passe — le scan marche en local)

---

## Checklist

- [ ] NPM Forward Port = **8888**
- [ ] `https://…/api/jobsitepro/ocr-health` → gemini true
- [ ] App employé fermée et rouverte
- [ ] Nouveau scan testé

**Ce n’est pas un bug PocketBase ni Gemini — c’est uniquement NPM.**
