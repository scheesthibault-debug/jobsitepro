/**
 * Génère knowify_collections_import.json — format PocketBase Admin → Import collections
 * Usage: node pocketbase/build-knowify-import.mjs
 */
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));

// IDs des collections existantes (pb_schema-import.json — même instance JobsitePro)
const CO = 'pbc_3866053794';      // companies
const SITES = 'pbc_2001081480';   // sites
const USERS = '_pb_users_auth_';  // users
const SOUM = 'ct_soumissions';    // soumissions

const RULES = {
  listRule: 'company = @request.auth.company',
  viewRule: 'company = @request.auth.company',
  createRule: '@request.auth.role = "admin"',
  updateRule: '@request.auth.role = "admin"',
  deleteRule: '@request.auth.role = "admin"',
};

const ID_FIELD = {
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
};

function rel(name, collectionId, id, opts = {}) {
  return {
    cascadeDelete: false,
    collectionId,
    hidden: false,
    id,
    maxSelect: opts.maxSelect ?? 1,
    minSelect: 0,
    name,
    presentable: false,
    required: !!opts.required,
    system: false,
    type: 'relation',
  };
}

function txt(name, id, opts = {}) {
  return {
    autogeneratePattern: '',
    hidden: false,
    id,
    max: 0,
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

function sel(name, id, values, opts = {}) {
  return {
    hidden: false,
    id,
    maxSelect: 1,
    name,
    presentable: false,
    required: !!opts.required,
    system: false,
    type: 'select',
    values,
  };
}

function num(name, id, opts = {}) {
  return {
    hidden: false,
    id,
    max: null,
    min: null,
    name,
    onlyInt: false,
    presentable: false,
    required: !!opts.required,
    system: false,
    type: 'number',
  };
}

function boo(name, id, opts = {}) {
  return {
    hidden: false,
    id,
    name,
    presentable: false,
    required: !!opts.required,
    system: false,
    type: 'bool',
  };
}

function dat(name, id, opts = {}) {
  return {
    hidden: false,
    id,
    max: '',
    min: '',
    name,
    presentable: false,
    required: !!opts.required,
    system: false,
    type: 'date',
  };
}

function eml(name, id) {
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

function json(name, id, opts = {}) {
  return {
    hidden: false,
    id,
    maxSize: 0,
    name,
    presentable: false,
    required: !!opts.required,
    system: false,
    type: 'json',
  };
}

function file(name, id) {
  return {
    hidden: false,
    id,
    maxSelect: 1,
    maxSize: 52428800,
    mimeTypes: null,
    name,
    presentable: false,
    protected: false,
    required: false,
    system: false,
    thumbs: null,
    type: 'file',
  };
}

function base(id, name, fields) {
  return { id, name, type: 'base', ...RULES, fields: [ID_FIELD, ...fields], indexes: [], system: false };
}

const PROV = ['QC', 'ON', 'BC', 'AB', 'MB', 'SK', 'NB', 'NS', 'PE', 'NL', 'NT', 'NU', 'YT'];

const collections = [
  base('ct_clients', 'clients', [
    rel('company', CO, 'fld_cl_company', { required: true }),
    txt('nom', 'fld_cl_nom', { required: true }),
    eml('email', 'fld_cl_email'),
    txt('telephone', 'fld_cl_tel'),
    txt('adresse', 'fld_cl_adr'),
    txt('ville', 'fld_cl_ville'),
    sel('province', 'fld_cl_prov', PROV),
    txt('code_postal', 'fld_cl_cp'),
    txt('notes', 'fld_cl_notes'),
    boo('is_active', 'fld_cl_active', { required: true }),
    txt('quickbooks_id', 'fld_cl_qb'),
  ]),
  base('ct_leads', 'leads', [
    rel('company', CO, 'fld_ld_company', { required: true }),
    txt('nom', 'fld_ld_nom', { required: true }),
    eml('email', 'fld_ld_email'),
    txt('telephone', 'fld_ld_tel'),
    txt('source', 'fld_ld_source'),
    sel('statut', 'fld_ld_statut', ['nouveau', 'contacte', 'qualifie', 'perdu', 'converti'], { required: true }),
    num('valeur_estimee', 'fld_ld_val'),
    txt('notes', 'fld_ld_notes'),
    rel('client', 'ct_clients', 'fld_ld_client'),
    dat('converti_le', 'fld_ld_conv'),
  ]),
  base('ct_factures', 'factures', [
    rel('company', CO, 'fld_fac_company', { required: true }),
    rel('created_by', USERS, 'fld_fac_by', { required: true }),
    rel('client', 'ct_clients', 'fld_fac_client', { required: true }),
    rel('site', SITES, 'fld_fac_site'),
    rel('soumission', SOUM, 'fld_fac_sou'),
    txt('numero', 'fld_fac_num', { required: true }),
    txt('titre', 'fld_fac_titre'),
    sel('province', 'fld_fac_prov', PROV, { required: true }),
    json('lignes', 'fld_fac_lignes', { required: true }),
    num('montant_ht', 'fld_fac_ht', { required: true }),
    num('montant_tps', 'fld_fac_tps', { required: true }),
    num('montant_tvq', 'fld_fac_tvq'),
    num('montant_ttc', 'fld_fac_ttc', { required: true }),
    num('montant_paye', 'fld_fac_paye', { required: true }),
    num('solde', 'fld_fac_solde', { required: true }),
    sel('statut', 'fld_fac_statut', ['brouillon', 'envoyee', 'partielle', 'payee', 'annulee'], { required: true }),
    dat('date_emission', 'fld_fac_emis'),
    dat('date_echeance', 'fld_fac_ech'),
    txt('notes', 'fld_fac_notes'),
    boo('relance_envoyee', 'fld_fac_rel'),
    txt('quickbooks_id', 'fld_fac_qb'),
  ]),
  base('ct_paiements', 'paiements', [
    rel('company', CO, 'fld_pay_company', { required: true }),
    rel('facture', 'ct_factures', 'fld_pay_fac'),
    rel('client', 'ct_clients', 'fld_pay_client'),
    num('montant', 'fld_pay_montant', { required: true }),
    dat('date_paiement', 'fld_pay_date', { required: true }),
    sel('methode', 'fld_pay_meth', ['comptant', 'cheque', 'virement', 'carte', 'autre'], { required: true }),
    txt('reference', 'fld_pay_ref'),
    txt('notes', 'fld_pay_notes'),
    txt('quickbooks_id', 'fld_pay_qb'),
  ]),
  base('ct_daily_logs', 'daily_logs', [
    rel('company', CO, 'fld_dl_company', { required: true }),
    rel('site', SITES, 'fld_dl_site', { required: true }),
    dat('log_date', 'fld_dl_date', { required: true }),
    txt('resume', 'fld_dl_resume'),
    txt('meteo', 'fld_dl_meteo'),
    json('entries', 'fld_dl_entries'),
    boo('auto_genere', 'fld_dl_auto', { required: true }),
    rel('created_by', USERS, 'fld_dl_by'),
  ]),
  base('ct_service_tickets', 'service_tickets', [
    rel('company', CO, 'fld_tk_company', { required: true }),
    rel('client', 'ct_clients', 'fld_tk_client'),
    rel('site', SITES, 'fld_tk_site'),
    txt('titre', 'fld_tk_titre', { required: true }),
    txt('description', 'fld_tk_desc'),
    sel('priorite', 'fld_tk_prio', ['basse', 'normale', 'haute', 'urgente'], { required: true }),
    sel('statut', 'fld_tk_statut', ['ouvert', 'planifie', 'en_cours', 'termine', 'annule'], { required: true }),
    rel('assigne_a', USERS, 'fld_tk_assign'),
    dat('date_planifiee', 'fld_tk_plan'),
    dat('date_terminee', 'fld_tk_done'),
    rel('created_by', USERS, 'fld_tk_by'),
  ]),
  base('ct_contrats', 'contrats', [
    rel('company', CO, 'fld_ct_company', { required: true }),
    rel('client', 'ct_clients', 'fld_ct_client', { required: true }),
    rel('site', SITES, 'fld_ct_site'),
    txt('titre', 'fld_ct_titre', { required: true }),
    txt('description', 'fld_ct_desc'),
    num('montant', 'fld_ct_montant'),
    sel('statut', 'fld_ct_statut', ['brouillon', 'actif', 'suspendu', 'termine', 'annule'], { required: true }),
    dat('date_debut', 'fld_ct_debut'),
    dat('date_fin', 'fld_ct_fin'),
    file('fichier', 'fld_ct_file'),
    rel('created_by', USERS, 'fld_ct_by'),
  ]),
  base('ct_activity_events', 'activity_events', [
    rel('company', CO, 'fld_ae_company', { required: true }),
    rel('actor', USERS, 'fld_ae_actor'),
    sel('entity_type', 'fld_ae_etype', ['client', 'lead', 'site', 'soumission', 'facture', 'paiement', 'expense', 'time_entry', 'daily_log', 'ticket', 'contrat'], { required: true }),
    txt('entity_id', 'fld_ae_eid', { required: true }),
    sel('activity', 'fld_ae_act', ['created', 'updated', 'status_changed', 'assigned', 'approved', 'paid', 'converted', 'comment'], { required: true }),
    txt('message', 'fld_ae_msg', { required: true }),
    json('metadata', 'fld_ae_meta'),
  ]),
  base('ct_quickbooks_sync', 'quickbooks_sync', [
    rel('company', CO, 'fld_qb_company', { required: true }),
    sel('entity_type', 'fld_qb_etype', ['client', 'facture', 'paiement', 'expense'], { required: true }),
    txt('local_id', 'fld_qb_lid', { required: true }),
    txt('quickbooks_id', 'fld_qb_qbid'),
    dat('last_synced', 'fld_qb_sync'),
    sel('sync_direction', 'fld_qb_dir', ['push', 'pull', 'bidirectional'], { required: true }),
    txt('sync_error', 'fld_qb_err'),
  ]),
];

const outPath = join(__dir, 'knowify_collections_import.json');
writeFileSync(outPath, JSON.stringify(collections, null, 2), 'utf8');
console.log('Written:', outPath, `(${collections.length} collections)`);
