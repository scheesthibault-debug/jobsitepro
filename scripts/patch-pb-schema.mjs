/**
 * Met à jour pb_schema (2).json — JobsitePro (Dext / Knowify / coûts)
 * Usage: node scripts/patch-pb-schema.mjs
 */
import fs from 'fs';
import path from 'path';

const SOURCES = [
  path.join(process.env.USERPROFILE || '', 'Downloads', 'pb_schema (2).json'),
  path.join(process.env.USERPROFILE || '', 'Downloads', 'pb_schema (1).json'),
  path.join(process.cwd(), 'pocketbase', 'pb_schema (2).json'),
  path.join(process.cwd(), 'pocketbase', 'pb_schema (1).json'),
];

const src = SOURCES.find((p) => fs.existsSync(p));
if (!src) {
  console.error('Fichier introuvable:', SOURCES.join(' ou '));
  process.exit(1);
}

const schema = JSON.parse(fs.readFileSync(src, 'utf8'));

function findCollection(name) {
  return schema.find((c) => c.name === name);
}

function hasField(coll, name) {
  return coll.fields.some((f) => f.name === name);
}

function textField(name, id, opts = {}) {
  return {
    autogeneratePattern: '',
    help: opts.help || '',
    hidden: false,
    id,
    max: opts.max ?? 0,
    min: 0,
    name,
    pattern: '',
    presentable: false,
    primaryKey: false,
    required: !!opts.required,
    system: false,
    type: 'text',
  };
}

function numberField(name, id, opts = {}) {
  return {
    help: opts.help || '',
    hidden: false,
    id,
    max: null,
    min: null,
    name,
    onlyInt: false,
    presentable: false,
    required: false,
    system: false,
    type: 'number',
  };
}

function selectField(name, id, values, maxSelect = 1) {
  return {
    help: '',
    hidden: false,
    id,
    maxSelect,
    name,
    presentable: false,
    required: false,
    system: false,
    type: 'select',
    values,
  };
}

function relationField(name, id, collectionId, maxSelect = 1) {
  return {
    cascadeDelete: false,
    collectionId,
    help: '',
    hidden: false,
    id,
    maxSelect,
    minSelect: 0,
    name,
    presentable: false,
    required: false,
    system: false,
    type: 'relation',
  };
}

function jsonField(name, id) {
  return {
    help: '',
    hidden: false,
    id,
    maxSize: 0,
    name,
    presentable: false,
    required: false,
    system: false,
    type: 'json',
  };
}

function fileField(name, id, mimeTypes = null) {
  return {
    help: '',
    hidden: false,
    id,
    maxSelect: 1,
    maxSize: 52428800,
    mimeTypes,
    name,
    presentable: false,
    protected: false,
    required: false,
    system: false,
    thumbs: ['80x80', '200x200'],
    type: 'file',
  };
}

function dateField(name, id) {
  return {
    help: '',
    hidden: false,
    id,
    max: '',
    min: '',
    name,
    presentable: false,
    required: false,
    system: false,
    type: 'date',
  };
}

function emailField(name, id) {
  return {
    exceptDomains: null,
    hidden: false,
    id,
    name,
    onlyDomains: null,
    presentable: false,
    required: false,
    system: false,
    type: 'email',
  };
}

function addFields(coll, fields) {
  for (const f of fields) {
    if (!hasField(coll, f.name)) coll.fields.push(f);
  }
}

function setHelp(coll, fieldName, help) {
  const f = coll.fields.find((x) => x.name === fieldName);
  if (f) f.help = help;
}

// —— companies ——
const companies = findCollection('companies');
if (companies) {
  addFields(companies, [
    numberField('mileage_rate', 'fld_co_mileage_rate', { help: 'Taux $/km (défaut app: 0.70)' }),
    selectField('tax_province', 'fld_co_tax_prov', ['QC', 'ON', 'BC', 'AB', 'MB', 'SK', 'NB', 'NS', 'PE', 'NL', 'NT', 'NU', 'YT']),
    textField('soumission_prefix', 'fld_co_sou_prefix', { help: 'Ex. SOU-2026' }),
    numberField('soumission_next_num', 'fld_co_sou_num', { help: 'Prochain numéro séquentiel' }),
    jsonField('integrations_config', 'fld_co_integrations'),
  ]);
  setHelp(companies, 'mileage_rate', 'Taux $/km (défaut app: 0.70)');
  setHelp(companies, 'soumission_prefix', 'Préfixe numérotation soumissions (ex. SOU-2026)');
  setHelp(companies, 'tax_province', 'Province pour taxes soumissions (Canada)');
}

// —— expenses (Dext) ——
const expenses = findCollection('expenses');
if (expenses) {
  addFields(expenses, [
    textField('vendor', 'fld_ex_vendor'),
    numberField('tax_amount', 'fld_ex_tax', { help: 'TPS/TVQ/HST extrait du reçu' }),
    textField('manager_note', 'fld_ex_mgr_note'),
    textField('employee_note', 'fld_ex_emp_note'),
    jsonField('ocr_raw', 'fld_ex_ocr_raw'),
    selectField('ocr_confidence', 'fld_ex_ocr_conf', ['high', 'low', 'manual']),
    selectField('payment_method', 'fld_ex_payment', ['unpaid', 'company_card', 'employee_pocket'], 1),
  ]);
  setHelp(expenses, 'payment_method', 'Non payé / compte compagnie / poche employé');
  setHelp(expenses, 'amount', 'Montant TTC ($)');
  setHelp(expenses, 'tax_amount', 'Montant taxes seulement ($)');
  const receipt = expenses.fields.find((f) => f.name === 'receipt');
  if (receipt) {
    receipt.mimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];
    receipt.thumbs = ['80x80', '200x200'];
  }
}

// —— notifications ——
const notifs = findCollection('notifications');
if (notifs) {
  // Employés peuvent notifier le patron (ex. nouvelle dépense)
  notifs.createRule = '@request.auth.id != "" && company = @request.auth.company';
  const typeF = notifs.fields.find((f) => f.name === 'type');
  if (typeF && Array.isArray(typeF.values)) {
    for (const v of ['leave', 'paystub', 'payroll_doc', 'expense', 'soumission']) {
      if (!typeF.values.includes(v)) typeF.values.push(v);
    }
  }
}

// —— sites (job costing) ——
const sites = findCollection('sites');
if (sites) {
  addFields(sites, [
    relationField('soumission', 'fld_site_soumission', 'ct_soumissions'),
    numberField('budget_labor', 'fld_site_bud_labor', { help: 'Budget main-d\'œuvre ($)' }),
    numberField('budget_materials', 'fld_site_bud_mat', { help: 'Budget matériaux ($)' }),
    numberField('budget_expenses', 'fld_site_bud_exp', { help: 'Budget dépenses ($)' }),
  ]);
}

// —— soumissions (Knowify) ——
if (!findCollection('soumissions')) {
  schema.push({
    id: 'ct_soumissions',
    listRule: 'company = @request.auth.company',
    viewRule: 'company = @request.auth.company',
    createRule: '@request.auth.role = "admin"',
    updateRule: '@request.auth.role = "admin"',
    deleteRule: '@request.auth.role = "admin"',
    name: 'soumissions',
    type: 'base',
    fields: [
      {
        autogeneratePattern: '[a-z0-9]{15}',
        hidden: false,
        id: 'text3208210256',
        max: 15,
        min: 15,
        name: 'id',
        pattern: '^[a-z0-9]+$',
        presentable: false,
        primaryKey: true,
        required: true,
        system: true,
        type: 'text',
      },
      relationField('company', 'fld_sou_company', 'pbc_3866053794'),
      relationField('created_by', 'fld_sou_created_by', '_pb_users_auth_'),
      textField('numero', 'fld_sou_numero', { help: 'Ex. SOU-2026-0001' }),
      textField('titre', 'fld_sou_titre', { required: true }),
      textField('client_nom', 'fld_sou_client_nom', { required: true }),
      emailField('client_email', 'fld_sou_client_email'),
      textField('client_tel', 'fld_sou_client_tel'),
      textField('adresse', 'fld_sou_adresse'),
      selectField('province', 'fld_sou_province', ['QC', 'ON', 'BC', 'AB', 'MB', 'SK', 'NB', 'NS', 'PE', 'NL', 'NT', 'NU', 'YT']),
      jsonField('phases', 'fld_sou_phases'),
      numberField('montant_ht', 'fld_sou_ht'),
      numberField('montant_tps', 'fld_sou_tps', { help: 'GST ou HST selon province' }),
      numberField('montant_tvq', 'fld_sou_tvq', { help: 'PST/QST selon province' }),
      numberField('montant_ttc', 'fld_sou_ttc'),
      selectField('statut', 'fld_sou_statut', ['brouillon', 'envoye', 'accepte', 'refuse', 'expire']),
      textField('notes', 'fld_sou_notes'),
      relationField('site', 'fld_sou_site', 'pbc_2001081480'),
      dateField('date_soumission', 'fld_sou_date_sub'),
      dateField('date_expiration', 'fld_sou_date_exp'),
      fileField('pdf_file', 'fld_sou_pdf', ['application/pdf']),
    ],
    indexes: [],
    system: false,
  });
  console.log('+ collection soumissions');
} else {
  const sou = findCollection('soumissions');
  setHelp(sou, 'phases', 'JSON: phases + lignes MO/matériaux');
  setHelp(sou, 'montant_tps', 'GST ou HST selon province');
  setHelp(sou, 'montant_tvq', 'PST/QST selon province');
}

// —— tracking_events (carte live) ——
const tracking = findCollection('tracking_events');
if (tracking) {
  if (!tracking.listRule?.includes('company')) {
    tracking.listRule = 'employee = @request.auth.id || company = @request.auth.company';
    tracking.viewRule = 'employee = @request.auth.id || company = @request.auth.company';
  }
  if (tracking.createRule?.includes('\n')) {
    tracking.createRule = tracking.createRule.trim();
  }
}

const out = JSON.stringify(schema, null, 2) + '\n';
const targets = [
  path.join(process.env.USERPROFILE || '', 'Downloads', 'pb_schema (2).json'),
  path.join(process.cwd(), 'pocketbase', 'pb_schema (2).json'),
];

for (const t of targets) {
  try {
    fs.mkdirSync(path.dirname(t), { recursive: true });
    fs.writeFileSync(t, out);
    console.log('OK', t);
  } catch (e) {
    console.warn('Skip', t, e.message);
  }
}

console.log(`
Modifications appliquées:
  • expenses: vendor, tax_amount, notes, ocr_*, PDF/images reçus
  • companies: mileage_rate, tax_province, soumission_prefix/next_num
  • sites: soumission, budget_labor/materials/expenses
  • soumissions: collection complète (Knowify)
  • notifications: createRule employés + type soumission
  • tracking_events: règles API normalisées

Import PocketBase: ajoutez les champs MANUELLEMENT en prod (ne pas ré-importer tout le schéma).
`);
