#!/usr/bin/env node
/**
 * Génère push/vapid.json (clés VAPID + config PocketBase).
 * Usage: node generate-vapid.js
 * Puis renseigner adminToken (PocketBase → Settings → Token de l'API).
 */
const fs = require('fs');
const path = require('path');
const webpush = require('web-push');

const outPath = path.join(__dirname, 'vapid.json');
const keys = webpush.generateVAPIDKeys();

const config = {
  subject: 'mailto:admin@chantiertrack.local',
  publicKey: keys.publicKey,
  privateKey: keys.privateKey,
  pocketbaseUrl: process.env.POCKETBASE_URL || 'http://127.0.0.1:8090',
  adminToken: '',
  port: 3099,
};

fs.writeFileSync(outPath, JSON.stringify(config, null, 2));
console.log('✓ Fichier créé:', outPath);
console.log('  1. Ouvrez PocketBase Admin → Settings → Token de l\'API → générez un token admin');
console.log('  2. Collez-le dans vapid.json → champ "adminToken"');
console.log('  3. npm start');
console.log('  Clé publique (pour vérif):', keys.publicKey.slice(0, 20) + '...');
