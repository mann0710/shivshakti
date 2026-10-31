import {
  billPayments, preorderPayments, billLedger, preorderLedger, splitPay, payEntries, refundEntries, withAdvance, cashChips, modeOf, dueOf, Payment,
} from './payments';
import { emptyForm, totalsOf, toOrderPayload, toPreorderPayload, validate, formFromOrder } from './posForm';
import { owedBy, billDue, bookingDue, isTestBill } from './dues';
import { holdBill, takeHeld, heldSummary } from './heldBills';
import { orderReceipt, payLines, reminderText } from './sessionalReceipts';
import { posBillHtml } from './thermalSlips';
import { DEFAULT_DOC_SETTINGS } from './docs/settings';

const AT = '2026-11-01T10:00:00.000Z';
const line = { item_id: 'k', item_name: 'Kaju Katli', weight: 500, weight_unit: 'gm' as const, price: 490, qty: 2, line_total: 980 };
const bill = (o: object = {}) => ({ id: 'b1', bill_no: 7, customer_name: 'Ramesh', phone: '9824012345', items: [line], subtotal: 980, discount_amount: 0,
  discount_type: 'amount' as const, total_amount: 980, is_paid: true, payment_mode: 'cash' as const, year: 2026, created_at: AT, ...o }) as any;
const booking = (o: object = {}) => ({ id: 'p1', customer_name: 'Sita', phone: '9898989898', items: [line], subtotal: 980, discount_amount: 0,
  discount_type: 'amount' as const, total_amount: 980, advance_paid: 300, payment_mode: 'upi' as const, status: 'pending' as const, year: 2026, created_at: AT, ...o }) as any;
const ctx = { settings: { ...DEFAULT_DOC_SETTINGS, bill_footer: '' }, logo: '' };

describe('payment ledger', () => {
  it('reads older paid bills as one payment and leaves unpaid ones empty', () => {
    expect(billPayments(bill())).toEqual([{ amount: 980, mode: 'cash', at: AT, kind: 'sale' }]);
    expect(billPayments(bill({ is_paid: false, payment_mode: null }))).toEqual([]);
    expect(billPayments(bill({ cancelled_at: AT }))).toEqual([]);
  });
  it('rebuilds booking advance and hand-over money', () => {
    const p = booking({ advance_paid: 980, balance_paid: 680, balance_mode: 'cash', delivered_at: '2026-11-03T08:00:00Z', status: 'delivered' });
    expect(preorderPayments(p).map(x => [x.kind, x.mode, x.amount])).toEqual([['advance', 'upi', 300], ['handover', 'cash', 680]]);
  });
  it('keeps is_paid, paid amount and mode in step', () => {
    const list: Payment[] = [{ amount: 500, mode: 'cash', at: AT, kind: 'sale' }, { amount: 480, mode: 'upi', at: '2026-11-02T10:00:00Z', kind: 'due' }];
    expect(billLedger(980, list)).toMatchObject({ paid_amount: 980, is_paid: true, payment_mode: 'mixed', paid_at: '2026-11-02T10:00:00Z' });
    expect(billLedger(980, list.slice(0, 1))).toMatchObject({ is_paid: false, payment_mode: 'cash' });
    expect(billLedger(980, [], true).is_paid).toBe(true);
    expect(dueOf(980, list.slice(0, 1))).toBe(480);
  });
  it('splits cash, UPI and change', () => {
    expect(splitPay('cash', 740, '', '1000')).toEqual({ cash: 740, upi: 0, tendered: 1000, change: 260 });
    expect(splitPay('split', 740, '500', '')).toEqual({ cash: 500, upi: 240, tendered: 0, change: 0 });
    expect(splitPay('split', 740, '900', '')).toMatchObject({ cash: 740, upi: 0 });
    expect(splitPay('unpaid', 740, '', '')).toMatchObject({ cash: 0, upi: 0 });
    expect(payEntries(splitPay('cash', 740, '', '1000'), AT)).toEqual([{ amount: 740, mode: 'cash', at: AT, kind: 'sale', tendered: 1000 }]);
  });
  it('suggests exact and round cash amounts', () => {
    expect(cashChips(740)).toEqual([740, 750, 800, 1000]);
    expect(cashChips(500)).toEqual([500, 1000, 2000]);
    expect(cashChips(0)).toEqual([]);
  });
  it('refunds cash first and books advance changes as the difference', () => {
    const paid: Payment[] = [{ amount: 100, mode: 'cash', at: AT, kind: 'sale' }, { amount: 400, mode: 'upi', at: AT, kind: 'sale' }];
    expect(refundEntries(paid, 250, AT).map(p => [p.mode, p.amount])).toEqual([['cash', -100], ['upi', -150]]);
    const adv = withAdvance([{ amount: 300, mode: 'upi', at: AT, kind: 'advance' }], 500, 'cash', 'later');
    expect(adv[1]).toEqual({ amount: 200, mode: 'cash', at: 'later', kind: 'advance' });
    expect(preorderLedger(adv)).toMatchObject({ advance_paid: 500, balance_paid: 0, payment_mode: 'cash' });
    expect(modeOf([])).toBeNull();
  });
});

describe('counter bill form', () => {
  const form = (o: object = {}) => ({ ...emptyForm(), lines: [line], ...o });
  it('records cash handed over and the change', () => {
    const f = form({ received: '1000' });
    const t = totalsOf(f);
    expect(t.change).toBe(20);
    expect(toOrderPayload(f, t, 2026, [], AT)).toMatchObject({ is_paid: true, paid_amount: 980, payment_mode: 'cash', payments: [{ tendered: 1000 }] });
  });
  it('needs a cash part for Cash + UPI and a name for unpaid', () => {
    expect(validate(form({ payment: 'split' }), totalsOf(form({ payment: 'split' })))).toMatch(/cash part/);
    expect(validate(form({ payment: 'unpaid' }), totalsOf(form({ payment: 'unpaid' })))).toMatch(/name and phone/);
    const unpaid = form({ payment: 'unpaid', customer_name: 'Ramesh', phone: '9824012345' });
    expect(toOrderPayload(unpaid, totalsOf(unpaid), 2026, [], AT)).toMatchObject({ is_paid: false, paid_amount: 0, payments: [] });
  });
  it('taking back items hands back the difference', () => {
    const f = { ...formFromOrder(bill()), lines: [{ ...line, qty: 1, line_total: 490 }] };
    const t = totalsOf(f);
    expect(t.refund).toBe(490);
    const out = toOrderPayload(f, t, 2026, billPayments(bill()), 'later');
    expect(out).toMatchObject({ total_amount: 490, paid_amount: 490, is_paid: true });
    expect(out.payments?.[1]).toEqual({ amount: -490, mode: 'cash', at: 'later', kind: 'refund' });
  });
  it('books the advance in the ledger', () => {
    const f = { ...emptyForm('preorder'), lines: [line], advance: '300', advance_mode: 'upi' as const };
    expect(toPreorderPayload(f, totalsOf(f), 2026, [], AT)).toMatchObject({ advance_paid: 300, payment_mode: 'upi', payments: [{ kind: 'advance', amount: 300 }] });
  });
});

describe('dues, held bills and receipts', () => {
  it('sums what a customer already owes', () => {
    const orders = [bill({ id: 'a', is_paid: false, payment_mode: null }), bill({ id: 'b', is_paid: false, cancelled_at: AT }), bill({ id: 'c' })];
    const pre = [booking({ status: 'delivered', advance_paid: 900 }), booking({ id: 'p2' })];
    expect(owedBy('+91 98240 12345', orders, [])).toEqual({ amount: 980, count: 1 });
    expect(owedBy('9898989898', [], pre)).toEqual({ amount: 80, count: 1 });
    expect(billDue(orders[1])).toBe(0);
    expect(bookingDue(pre[1])).toBe(0);
    expect(isTestBill({ customer_name: 'Test', notes: '' })).toBe(true);
    expect(isTestBill({ customer_name: 'Testa Bhai', notes: '' })).toBe(false);
  });
  it('holds several bills and swaps the current one back in', () => {
    const a = { ...emptyForm(), customer_name: 'A', lines: [line] };
    const b = { ...emptyForm(), customer_name: 'B', lines: [line] };
    const held = holdBill(holdBill([], a, AT), b, AT);
    expect(held.map(h => h.form.customer_name)).toEqual(['B', 'A']);
    const out = takeHeld(held, held[1].id, { ...emptyForm(), customer_name: 'C', lines: [line] }, AT);
    expect(out.form?.customer_name).toBe('A');
    expect(out.list.map(h => h.form.customer_name)).toEqual(['C', 'B']);
    expect(heldSummary(held[0]).detail).toContain('₹980');
  });
  it('prints cash, UPI and change on the 80 mm bill without empty shop fields', () => {
    const o = bill({ payments: [{ amount: 500, mode: 'cash', at: AT, kind: 'sale', tendered: 1000 }, { amount: 480, mode: 'upi', at: AT, kind: 'sale' }] });
    const r = orderReceipt(o);
    expect(r.pay).toEqual({ cash: 1000, upi: 480, returned: 500, refunded: 0 });
    const html = posBillHtml(r, ctx);
    ['Cash', '₹1,000', 'UPI', '₹480', 'Returned', '₹500', 'Paid · Cash + UPI'].forEach(t => expect(r.status + html).toContain(t));
    expect(html).not.toContain('<b></b>');
    expect(posBillHtml(orderReceipt(bill({ is_paid: false, payment_mode: null })), ctx)).toContain('Balance due');
    expect(posBillHtml(orderReceipt(bill({ cancelled_at: AT, cancel_reason: 'Wrong item' })), ctx)).toContain('CANCELLED · Wrong item');
    expect(payLines([{ amount: -100, mode: 'cash', at: AT, kind: 'refund' }]).refunded).toBe(100);
    expect(reminderText('Ramesh', 480, 'bill #7')).toContain('₹480');
  });
});
