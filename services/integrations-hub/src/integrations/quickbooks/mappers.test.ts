import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isExpenseSyncable,
  isInvoiceSyncable,
  isTimeEntrySyncable,
  mapClientToQbCustomer,
  mapExpenseToQbPurchase,
  mapQbCustomerToClient,
} from './mappers.js';
import { splitRegularOt } from '../wagepoint/mapper.js';

describe('QuickBooks mappers', () => {
  it('maps client to QB customer', () => {
    const payload = mapClientToQbCustomer({
      id: 'c1',
      company: 'co1',
      nom: 'Client Test',
      email: 'a@b.com',
    });
    assert.equal(payload.DisplayName, 'Client Test');
    assert.equal(payload.PrimaryEmailAddr?.Address, 'a@b.com');
  });

  it('maps QB customer to JobsitePro client (import)', () => {
    const client = mapQbCustomerToClient(
      {
        Id: '58',
        DisplayName: 'Constructions ABC',
        PrimaryEmailAddr: { Address: 'info@abc.com' },
        PrimaryPhone: { FreeFormNumber: '514-555-1234' },
        BillAddr: { Line1: '123 rue Principale', City: 'Montréal', CountrySubDivisionCode: 'QC', PostalCode: 'H1A 1A1' },
        Active: true,
      },
      'co1',
    );
    assert.equal(client.nom, 'Constructions ABC');
    assert.equal(client.email, 'info@abc.com');
    assert.equal(client.province, 'QC');
    assert.equal(client.quickbooks_id, '58');
  });

  it('drops invalid province on import', () => {
    const client = mapQbCustomerToClient({ Id: '9', DisplayName: 'X', BillAddr: { CountrySubDivisionCode: 'CA' } }, 'co1');
    assert.equal(client.province, undefined);
  });

  it('blocks unapproved expense', () => {
    assert.equal(isExpenseSyncable({ id: 'e1', company: 'c', status: 'pending' }), false);
    assert.equal(isExpenseSyncable({ id: 'e1', company: 'c', status: 'approved' }), true);
  });

  it('maps approved expense to purchase', () => {
    const p = mapExpenseToQbPurchase({
      id: 'e1',
      company: 'c',
      amount: 100,
      status: 'approved',
      description: 'Fuel',
    });
    assert.equal(p.Line[0].Amount, 100);
  });

  it('blocks draft invoice', () => {
    assert.equal(isInvoiceSyncable({ id: 'f1', company: 'c', statut: 'brouillon' }), false);
    assert.equal(isInvoiceSyncable({ id: 'f1', company: 'c', statut: 'envoyee' }), true);
  });

  it('blocks open time entry', () => {
    assert.equal(
      isTimeEntrySyncable({
        id: 't1',
        company: 'c',
        employee: 'u1',
        clock_in: '2026-06-01T08:00:00Z',
      }),
      false,
    );
    assert.equal(
      isTimeEntrySyncable({
        id: 't1',
        company: 'c',
        employee: 'u1',
        clock_in: '2026-06-01T08:00:00Z',
        clock_out: '2026-06-01T16:00:00Z',
        duration_min: 480,
      }),
      true,
    );
  });
});

describe('Wagepoint mapper', () => {
  it('splits regular and OT hours', () => {
    const { regular, overtime } = splitRegularOt(10);
    assert.equal(regular, 8);
    assert.equal(overtime, 2);
  });
});
