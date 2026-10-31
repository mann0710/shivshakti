import { planCustomers, customerSheet } from './importCustomers';
import type { Customer } from '../types';
import type { XCell } from './xlsx';

const at = '2026-01-01T00:00:00Z';
const cust = (id: string, name: string, phone: string, extra: Partial<Customer> = {}): Customer => ({ id, name, phone, address: '', created_at: at, ...extra });
const saved = [
  cust('a', 'Kaushal bhai', '9913814443'),
  cust('b', 'Vijay Patel', '+91 99747 06360', { email: 'vijay@x.com' }),
  cust('c', 'Nayan Khothari', ''),
  cust('d', 'Ramesh Shah', '9825012345'),
];
const ids = () => { let n = 0; return () => `new${++n}`; };
const plan = (rows: XCell[][], answers = {}) => planCustomers([{ name: 'Customers', rows: [['Customer Name', 'Phone', 'E-mail', 'Address', 'GST No'], ...rows] }], saved, answers, ids());

describe('customers import', () => {
  it('matches by mobile, then by exact name, and never blanks a saved value', () => {
    const p = plan([
      ['Kaushal Shah', '99138 14443', '', 'Paldi', ''],
      ['Vijay Patel', '9974706360', '', '', ''],
      ['nayan khothari', '9824433445', '', '', '24aaacb1234c1z5'],
      ['Meera Joshi', '9876543210', 'meera@x.com', '', ''],
    ]);
    expect(p.changes.map(c => [c.chip, c.name])).toEqual([
      ['Details changed', 'Kaushal bhai'], ['Same', 'Vijay Patel'], ['Details added', 'Nayan Khothari'], ['New customer', 'Meera Joshi'],
    ]);
    expect(p.writes.find(w => w.id === 'a')).toEqual({ table: 'customers', id: 'a', values: { name: 'Kaushal Shah', address: 'Paldi' }, old: { name: 'Kaushal bhai', address: '' } });
    expect(p.writes.find(w => w.id === 'c')?.values).toEqual({ phone: '9824433445', gstin: '24AAACB1234C1Z5' });
    expect(p.writes[0]).toEqual({ table: 'customers', id: 'new1', values: { id: 'new1', name: 'Meera Joshi', phone: '9876543210', email: 'meera@x.com', address: '', gstin: null } });
  });

  it('asks when a name is saved with another mobile, or the mobile is not 10 digits', () => {
    const rows = [['Ramesh Shah', '9000000001', '', '', ''], ['Ketan', '12345', '', '', '']];
    const p = plan(rows);
    expect(p.decisions.map(d => [d.text, d.yes, d.no])).toEqual([
      ['"Ramesh Shah" is already saved with mobile 98250 12345.', 'Same person — update it', 'Add as new customer'],
      ['Mobile "12345" for Ketan is not a 10-digit number.', 'Save without the mobile', 'Skip row'],
    ]);
    const yes = plan(rows, { 'same:2': true, 'phone:3': true });
    expect(yes.writes.map(w => [w.id, w.values.phone])).toEqual([['new1', ''], ['d', '9000000001']]);
    expect(plan(rows, { 'same:2': false, 'phone:3': false }).changes.map(c => c.chip)).toEqual(['New customer']);
  });

  it('leaves out a mobile listed twice', () => {
    expect(plan([['A', '9876543210'], ['B', '98765 43210']]).skipped).toEqual([{ row: 3, name: 'B', why: 'Listed twice; row 2 is used' }]);
  });

  it('downloads today\'s customers, which import back unchanged', () => {
    const sheet = customerSheet(saved);
    expect(sheet[0]).toEqual(['Name', 'Mobile', 'Email', 'Address', 'GSTIN']);
    expect(planCustomers([{ name: 'C', rows: sheet }], saved, {}, ids()).writes).toEqual([]);
  });
});
