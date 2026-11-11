import { creditItems, billItem, ageBucket } from './items';
import { accountsOf, accountMoney } from './accounts';
import { allocate, patchesFor, undoPatches } from './allocate';
import { ledgerOf } from './ledger';
import { checkCredit } from './checks';
import { creditReminder } from './messages';
import { matches, tabTotals, ageSplit, search } from './view';
import { DEFAULT_CREDIT, mergeCredit, CreditEntry } from './types';
import { moneyIn } from '../payments';
import { posBillHtml } from '../thermalSlips';
import { DEFAULT_DOC_SETTINGS } from '../docs/settings';
import { creditReport } from '../reports/credit';

const TODAY = '2026-11-11';
const line = { item_id: 'm', item_name: 'Mohanthal', weight: 1000, weight_unit: 'gm' as const, price: 560, qty: 1, line_total: 560 };
const bill = (o: object = {}) => ({ id: 'b1', bill_no: 12, customer_name: 'Hetal Patel', phone: '9825041736', items: [line], subtotal: 1120, discount_amount: 0,
  discount_type: 'amount' as const, total_amount: 1120, is_paid: false, payment_mode: null, year: 2026, created_at: '2026-10-01T06:00:00Z', payments: [], ...o }) as any;
const entry = (o: Partial<CreditEntry>): CreditEntry => ({ id: 'e1', phone: '9825041736', name: 'Hetal Patel', kind: 'note', amount: 0, mode: null, payments: [], links: [],
  due_date: null, promise_date: null, outcome: null, note: null, by_email: null, at: '2026-11-01T06:00:00Z', created_at: '2026-11-01T06:00:00Z', voided_at: null, ...o });

const hetal = () => [
  bill({ payments: [{ amount: 500, mode: 'cash', at: '2026-10-15T06:00:00Z', kind: 'due' }] }),
  bill({ id: 'b2', bill_no: 31, total_amount: 1960, created_at: '2026-10-20T06:00:00Z' }),
  bill({ id: 'b3', bill_no: 47, total_amount: 1250, created_at: '2026-11-02T06:00:00Z' }),
];
const build = (orders = hetal(), entries: CreditEntry[] = [], s = DEFAULT_CREDIT) => {
  const items = creditItems(orders, [], entries, s.pay_days);
  return accountsOf(items, entries, [], s, TODAY);
};

describe('credit items and accounts', () => {
  it('skips paid and walk-in bills', () => {
    expect(billItem(bill({ payments: [{ amount: 1120, mode: 'cash', at: 'x', kind: 'sale' }] }), 7)).toBeNull();
    expect(billItem(bill({ phone: '' }), 7)).toBeNull();
  });
  it('adds up one customer across bills, oldest first', () => {
    const [a] = build();
    expect(a.owed).toBe(3830);
    expect(a.open.map(i => i.due)).toEqual([620, 1960, 1250]);
    expect(a.oldest).toBe(41);
    expect(a.over).toBe(830);
    expect(a.follow).toBe('today');
  });
  it('buckets by bill age, not by person', () => {
    expect(ageSplit(build(), TODAY)).toEqual([0, 3210, 620, 0]);
    expect([0, 7, 8, 30, 31, 61].map(ageBucket)).toEqual([0, 0, 1, 1, 2, 3]);
  });
  it('keeps a promise until its date, then marks it broken', () => {
    const p = entry({ kind: 'promise', promise_date: '2026-11-14', amount: 3830 });
    expect(build(hetal(), [p])[0].promise?.broken).toBe(false);
    expect(build(hetal(), [p])[0].follow).toBe('later');
    const late = entry({ kind: 'promise', promise_date: '2026-11-08' });
    expect(matches(build(hetal(), [late])[0], 'late')).toBe(true);
  });
  it('waits remind_every days after the last contact', () => {
    const r = entry({ kind: 'reminder', at: '2026-11-10T06:00:00Z' });
    expect(build(hetal(), [r])[0].nextFollow).toBe('2026-11-13');
  });
  it('treats old balances like bills', () => {
    const o = entry({ id: 'o1', kind: 'opening', amount: 12500, at: '2026-09-09T06:00:00Z', phone: '9099055210', name: 'Jayesh' });
    const [a] = build([], [o]);
    expect(a.owed).toBe(12500);
    expect(a.open[0].label).toBe('Old balance');
  });
});

describe('receiving money', () => {
  it('pays the oldest first and leaves the rest', () => {
    const [a] = build();
    const { links, left } = allocate(a.open, 2000);
    expect(links.map(l => [l.id, l.amount])).toEqual([['b1', 620], ['b2', 1380]]);
    expect(left).toBe(0);
    expect(allocate(a.open, 500, 'b3').links).toEqual([{ type: 'bill', id: 'b3', amount: 500 }]);
  });
  it('tags payments and undoes only that receipt', () => {
    const [a] = build();
    const { links } = allocate(a.open, 2000);
    const patches = patchesFor(a.items, links, { mode: 'upi', at: '2026-11-11T06:00:00Z', kind: 'due', ref: 'r1' });
    expect(patches[0].payments).toHaveLength(2);
    const undone = undoPatches(patches.map(p => ({ ...p.item, payments: p.payments })), links, 'r1');
    expect(undone[0].payments).toHaveLength(1);
    expect(undone[1].payments).toHaveLength(0);
  });
  it('keeps extra money as an advance and counts it as money in', () => {
    const r = entry({ id: 'r1', kind: 'receipt', amount: 4000, mode: 'cash', links: [{ type: 'bill', id: 'b1', amount: 620 }] });
    const [a] = build(hetal(), [r]);
    expect(a.advance).toBe(3380);
    expect(moneyIn([], [], accountMoney([r])).map(m => m.amount)).toEqual([3380]);
  });
  it('never counts write-offs or advance used as money in', () => {
    const o = bill({ payments: [{ amount: 100, mode: 'cash', at: 'x', kind: 'writeoff' }, { amount: 50, mode: 'cash', at: 'x', kind: 'from_advance' }] });
    expect(moneyIn([o], [])).toEqual([]);
  });
});

describe('statement', () => {
  it('runs a balance that ends at what is owed', () => {
    const rows = ledgerOf(build()[0]);
    expect(rows.map(r => r.balance)).toEqual([1120, 620, 2580, 3830]);
  });
  it('drops a cancelled credit bill to zero', () => {
    const rows = ledgerOf(build([bill({ cancelled_at: '2026-10-02T06:00:00Z' })])[0]);
    expect(rows[rows.length - 1].balance).toBe(0);
  });
});

describe('counter checks', () => {
  it('passes a first small bill', () => {
    expect(checkCredit(undefined, 560, DEFAULT_CREDIT, TODAY).level).toBe('ok');
  });
  it('warns or blocks over the limit as set', () => {
    const [a] = build();
    expect(checkCredit(a, 100, DEFAULT_CREDIT, TODAY).level).toBe('warn');
    expect(checkCredit(a, 100, { ...DEFAULT_CREDIT, over: 'block' }, TODAY).level).toBe('block');
  });
  it('blocks a no-credit customer and when credit is off', () => {
    const [a] = build();
    expect(checkCredit({ ...a, settings: { phone: a.phone, name: a.name, credit_limit: null, no_credit: true, disputed: false, lang: 'en', note: null } }, 10, DEFAULT_CREDIT, TODAY).level).toBe('block');
    expect(checkCredit(undefined, 10, { ...DEFAULT_CREDIT, on: false }, TODAY).level).toBe('block');
  });
  it('uses an advance before counting against the limit', () => {
    expect(checkCredit(undefined, 500, DEFAULT_CREDIT, TODAY).after).toBe(500);
  });
});

describe('receipt and report', () => {
  it('prints the credit box with the earlier balance and a signature line', () => {
    const html = posBillHtml({ kind: 'Bill', number: '15', date: '11 Nov', customer_name: 'Hetal', lines: [], subtotal: 138, discount: 0, total: 138, status: 'Part paid',
      credit: { due: 100, earlier: 3830, payBy: 'Wed 18 Nov 2026', signature: true } } as any, { settings: DEFAULT_DOC_SETTINGS, logo: '' } as any);
    expect(html).toContain('CREDIT · PAY LATER');
    expect(html).toContain('Earlier balance');
    expect(html).toContain('Customer signature');
  });
  it('adds up given, got back and who owes', () => {
    const inp = { range: { from: '2026-10-01', to: TODAY }, today: TODAY, occasionId: '', orders: hetal(), unpaidOrders: [], preorders: [], items: [], occasions: [], bookings: [], invoices: [], payments: [], bookingValue: () => 0, credit: [] } as any;
    const r = creditReport(inp);
    expect(r.stats.map(s => s.value)).toEqual([4330, 500, 3830, 0]);
    expect(r.tables[1].total).toMatchObject({ a1: 3210, a2: 620, total: 3830 });
  });
});

describe('reminders, settings and search', () => {
  it('writes one message in English or Hindi', () => {
    const [a] = build();
    const en = creditReminder(a, 'en', { name: 'Shiv Shakti Sweets', upi: 'shop@upi' }, TODAY);
    expect(en).toContain('₹3,830 is due on 3 bills');
    expect(en).toContain('shop@upi');
    expect(creditReminder(a, 'hi', { name: 'Shiv Shakti Sweets', upi: '' }, TODAY)).toContain('नमस्ते Hetal जी');
  });
  it('checks saved settings', () => {
    expect(mergeCredit({ limit: -5, over: 'block', pay_days: 0 })).toMatchObject({ limit: 3000, over: 'block', pay_days: 7 });
  });
  it('finds by name, mobile or bill number', () => {
    const list = build();
    expect(search(list, '41736')).toHaveLength(1);
    expect(search(list, '#47')).toHaveLength(1);
    expect(search(list, 'zzz')).toHaveLength(0);
  });
  it('totals the tab', () => {
    const t = tabTotals(build(), TODAY);
    expect(t).toMatchObject({ owed: 3830, people: 1, follow: 1, given: 1250, givenCount: 1 });
  });
});
