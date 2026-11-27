/**
 * Génère jobsitepro-final-import.json — import PocketBase complet (merge)
 * Usage: node pocketbase/build-final-import.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execSync } from 'child_process';

const __dir = dirname(fileURLToPath(import.meta.url));

function loadJson(path) {
  if (!existsSync(path)) return [];
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  if (Array.isArray(raw)) return raw;
  return [];
}

function fieldKey(f) {
  return f?.name || '';
}

/** Fusionne champs manquants dans une collection existante */
function mergeCollectionFields(target, source) {
  if (!source?.fields?.length) return target;
  const names = new Set((target.fields || []).map(fieldKey));
  for (const f of source.fields) {
    const n = fieldKey(f);
    if (!n || names.has(n)) continue;
    target.fields.push(f);
    names.add(n);
  }
  if (!target.listRule && source.listRule) target.listRule = source.listRule;
  if (!target.viewRule && source.viewRule) target.viewRule = source.viewRule;
  if (!target.createRule && source.createRule) target.createRule = source.createRule;
  if (!target.updateRule && source.updateRule) target.updateRule = source.updateRule;
  if (!target.deleteRule && source.deleteRule) target.deleteRule = source.deleteRule;
  return target;
}

function mergeAll(baseList, ...extras) {
  const byName = new Map();
  const byId = new Map();
  for (const col of baseList) {
    if (!col?.name) continue;
    byName.set(col.name, structuredClone(col));
    if (col.id) byId.set(col.id, col.name);
  }
  for (const list of extras) {
    for (const col of list) {
      if (!col?.name) continue;
      const existing = byName.get(col.name);
      if (existing) {
        mergeCollectionFields(existing, col);
      } else if (col.id && byId.has(col.id)) {
        mergeCollectionFields(byName.get(byId.get(col.id)), col);
      } else {
        byName.set(col.name, structuredClone(col));
        if (col.id) byId.set(col.id, col.name);
      }
    }
  }
  return [...byName.values()];
}

// Régénérer Knowify (IDs companies/sites alignés)
const knowifyScript = join(__dir, 'build-knowify-import.mjs');
if (existsSync(knowifyScript)) {
  execSync(`node "${knowifyScript}"`, { stdio: 'inherit', cwd: join(__dir, '..') });
}

const base = loadJson(join(__dir, 'pb_schema-import.json'));
const knowify = loadJson(join(__dir, 'knowify_collections_import.json'));
const payrollGw = loadJson(join(__dir, 'payroll_gateway_collections.json'));
const payrollExtra = loadJson(join(__dir, 'payroll_collections.json'));
const rbacExtra = loadJson(join(__dir, 'rbac_collections.json'));

const merged = mergeAll(base, knowify, payrollGw, payrollExtra, rbacExtra);

const names = merged.map(c => c.name).sort();
const knowifyNames = [
  'clients', 'leads', 'factures', 'paiements', 'daily_logs',
  'service_tickets', 'contrats', 'activity_events', 'quickbooks_sync',
];
const missingKnowify = knowifyNames.filter(n => !names.includes(n));

const outPath = join(__dir, 'jobsitepro-final-import.json');
writeFileSync(outPath, JSON.stringify(merged, null, 2), 'utf8');

console.log('');
console.log('=== JobsitePro — import final ===');
console.log('Fichier:', outPath);
console.log('Collections:', merged.length);
console.log('Knowify CRM:', missingKnowify.length ? `MANQUANT ${missingKnowify.join(', ')}` : 'OK (9 modules)');
console.log('');
console.log('PocketBase Admin → Settings → Import collections');
console.log('Fichier: jobsitepro-final-import.json');
console.log('Mode: MERGE (étendre, ne pas remplacer)');
