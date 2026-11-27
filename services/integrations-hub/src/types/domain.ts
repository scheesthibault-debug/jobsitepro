/** Domaine JobsitePro — aligné sur collections PocketBase */

export interface Employee {
  id: string;
  company: string;
  name?: string;
  email?: string;
  job_title?: string;
  is_active?: boolean;
}

export interface TimeEntry {
  id: string;
  company: string;
  employee: string;
  site?: string;
  clock_in: string;
  clock_out?: string;
  duration_min?: number;
  /** Heures approuvées pour export paie — TODO: champ dédié en base */
  approved_for_payroll?: boolean;
  expand?: {
    employee?: Employee;
    site?: Job;
  };
}

export interface Job {
  id: string;
  company: string;
  name: string;
  address?: string;
  status?: string;
}

export interface Client {
  id: string;
  company: string;
  nom: string;
  email?: string;
  telephone?: string;
  adresse?: string;
  ville?: string;
  code_postal?: string;
  province?: string;
  quickbooks_id?: string;
}

export interface Invoice {
  id: string;
  company: string;
  client?: string;
  site?: string;
  numero?: string;
  titre?: string;
  statut?: string;
  montant_ht?: number;
  montant_ttc?: number;
  date_emission?: string;
  lignes?: unknown;
  quickbooks_id?: string;
}

export interface Expense {
  id: string;
  company: string;
  employee?: string;
  site?: string;
  amount?: number;
  tax_amount?: number;
  description?: string;
  vendor?: string;
  category?: string;
  expense_date?: string;
  status?: 'pending' | 'approved' | 'rejected';
}
