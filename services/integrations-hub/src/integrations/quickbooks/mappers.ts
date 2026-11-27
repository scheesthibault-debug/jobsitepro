import type { Client, Expense, Invoice, TimeEntry } from '../../types/domain.js';

export function mapClientToQbCustomer(client: Client) {
  return {
    DisplayName: client.nom?.slice(0, 100) || 'Client',
    PrimaryEmailAddr: client.email ? { Address: client.email } : undefined,
    PrimaryPhone: client.telephone ? { FreeFormNumber: client.telephone } : undefined,
    BillAddr: client.adresse
      ? {
          Line1: client.adresse,
          City: client.ville || '',
          PostalCode: client.code_postal || '',
          CountrySubDivisionCode: client.province || '',
        }
      : undefined,
  };
}

export function mapExpenseToQbPurchase(expense: Expense, vendorName = 'JobsitePro') {
  const amount = Number(expense.amount || 0);
  return {
    PaymentType: 'Cash',
    AccountRef: { name: 'Miscellaneous' },
    EntityRef: { name: vendorName },
    Line: [
      {
        Amount: amount,
        DetailType: 'AccountBasedExpenseLineDetail',
        AccountBasedExpenseLineDetail: {
          AccountRef: { name: 'Job Expenses' },
        },
        Description: expense.description || expense.category || 'Expense',
      },
    ],
    PrivateNote: `JobsitePro expense ${expense.id}`,
    TxnDate: (expense.expense_date || new Date().toISOString()).slice(0, 10),
  };
}

export function mapInvoiceToQb(invoice: Invoice, customerRefId: string) {
  const total = Number(invoice.montant_ttc || invoice.montant_ht || 0);
  return {
    CustomerRef: { value: customerRefId },
    DocNumber: invoice.numero || invoice.id.slice(0, 8),
    TxnDate: (invoice.date_emission || new Date().toISOString()).slice(0, 10),
    Line: [
      {
        Amount: total,
        DetailType: 'SalesItemLineDetail',
        SalesItemLineDetail: {
          ItemRef: { name: 'Services' },
        },
        Description: invoice.titre || 'Facture chantier',
      },
    ],
    PrivateNote: `JobsitePro invoice ${invoice.id}`,
  };
}

/** TimeActivity — MVP: heures approuvées uniquement */
export function mapTimeEntryToQbTimeActivity(entry: TimeEntry, employeeName: string, customerRefId?: string) {
  const mins = Number(entry.duration_min || 0);
  const hours = Math.max(0.01, Math.round((mins / 60) * 100) / 100);
  return {
    NameOf: customerRefId ? 'Customer' : 'Employee',
    CustomerRef: customerRefId ? { value: customerRefId } : undefined,
    EmployeeRef: customerRefId ? undefined : { name: employeeName },
    TxnDate: (entry.clock_in || new Date().toISOString()).slice(0, 10),
    Hours: Math.floor(hours),
    Minutes: Math.round((hours % 1) * 60),
    Description: `JobsitePro time ${entry.id}`,
  };
}

/** Provinces/États valides côté JobsitePro (select PocketBase) */
const VALID_PROVINCES = new Set(['QC', 'ON', 'BC', 'AB', 'MB', 'SK', 'NB', 'NS', 'PE', 'NL', 'NT', 'NU', 'YT']);

/** QuickBooks Customer → client JobsitePro (sens import / pull) */
export function mapQbCustomerToClient(c: Record<string, any>, companyId: string): Omit<Client, 'id'> {
  const addr = c.BillAddr || c.ShipAddr || {};
  const provinceRaw = String(addr.CountrySubDivisionCode || '').toUpperCase().trim();
  const nom =
    String(c.DisplayName || c.CompanyName || c.FullyQualifiedName || '').trim() ||
    String(c.GivenName || '') + ' ' + String(c.FamilyName || '');
  return {
    company: companyId,
    nom: nom.trim().slice(0, 120) || 'Client QuickBooks',
    email: c.PrimaryEmailAddr?.Address || undefined,
    telephone: c.PrimaryPhone?.FreeFormNumber || c.Mobile?.FreeFormNumber || undefined,
    adresse: [addr.Line1, addr.Line2].filter(Boolean).join(', ') || undefined,
    ville: addr.City || undefined,
    province: VALID_PROVINCES.has(provinceRaw) ? provinceRaw : undefined,
    code_postal: addr.PostalCode || undefined,
    quickbooks_id: String(c.Id || ''),
  };
}

export function isExpenseSyncable(expense: Expense) {
  return String(expense.status || '').toLowerCase() === 'approved';
}

export function isInvoiceSyncable(invoice: Invoice) {
  const s = String(invoice.statut || '').toLowerCase();
  return ['envoyee', 'emise', 'issued', 'sent', 'partielle', 'payee', 'paid'].includes(s);
}

export function isTimeEntrySyncable(entry: TimeEntry) {
  if (!entry.clock_out) return false;
  if (entry.approved_for_payroll === false) return false;
  // TODO: lier à table d'approbation horaires quand disponible
  return true;
}
