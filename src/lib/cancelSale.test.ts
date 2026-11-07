import { refundStart, withRefund, cancelBillFields, cancelBookingFields, bookingCancelReason, canCancelSale, canDeleteSale, deleteMessage } from './cancelSale';
import { billRows, billTotals, filterBills, stageCounts, NO_FILTER } from './billList';
import { bookingDue, owedBy } from './dues';
import { buildSheet } from './preorderSheet';
import { summarize } from './dayClose';
import { Payment } from './payments';
import { binText } from './recycleBin';

const AT = '2026-11-06T10:00:00.000Z';
const line = { item_id: 'k', item_name: 'Kaju Katli', weight: 500, weight_unit: 'gm' as const, price: 490, qty: 10, line_total: 4900 };
const given = (o: object = {}) => ({ id: 'a9a931ff', customer_name: 'Divyesh', phone: '9428691130', items: [line], subtotal: 4900, discount_amount: 0,
  discount_type: 'amount' as const, total_amount: 4900, advance_paid: 4900, payment_mode: 'upi' as const, status: 'delivered' as const, year: 2026,
  created_at: '2026-11-04T06:00:00Z', delivered_at: '2026-11-05T06:00:00Z', delivery_date: '2026-11-05', notes: 'Gift box',
  payments: [{ amount: 4900, mode: 'upi', at: '2026-11-05T06:00:00Z', kind: 'handover' }] as Payment[], ...o }) as any;
const bill = (o: object = {}) => ({ id: 'b1', bill_no: 7, customer_name: 'Ramesh', phone: '9824012345', items: [line], subtotal: 4900, discount_amount: 0,
  discount_type: 'amount' as const, total_amount: 4900, is_paid: true, payment_mode: 'cash' as const, year: 2026, created_at: '2026-11-05T06:00:00Z',
  payments: [{ amount: 3000, mode: 'cash', at: '2026-11-05T06:00:00Z', kind: 'sale' }, { amount: 1900, mode: 'upi', at: '2026-11-05T06:00:00Z', kind: 'sale' }], ...o }) as any;

describe('cancel a sale', () => {
  it('offers back everything received, in the mode most of it came in', () => {
    expect(refundStart(given().payments)).toEqual({ amount: 4900, mode: 'upi' });
    expect(refundStart(bill().payments)).toEqual({ amount: 4900, mode: 'cash' });
    expect(refundStart([])).toEqual({ amount: 0, mode: 'cash' });
  });
  it('records a refund as one negative entry, never more than received', () => {
    expect(withRefund(given().payments, { amount: 9999, mode: 'cash' }, AT).slice(-1)).toEqual([{ amount: -4900, mode: 'cash', at: AT, kind: 'refund' }]);
    expect(withRefund(given().payments, null, AT)).toHaveLength(1);
    expect(withRefund([], { amount: 100, mode: 'cash' }, AT)).toEqual([]);
  });
  it('cancels a given, paid pre-booking with reason and part refund', () => {
    const f = cancelBookingFields(given(), { reason: 'Customer changed mind', refund: { amount: 2000, mode: 'upi' }, at: AT }, true);
    expect(f).toMatchObject({ status: 'cancelled', cancelled_at: AT, cancel_reason: 'Customer changed mind', advance_paid: 2900 });
    expect(f.payments.slice(-1)[0]).toMatchObject({ amount: -2000, mode: 'upi', kind: 'refund' });
    expect(f).not.toHaveProperty('notes');
  });
  it('keeps the reason in the note when the cancel columns are missing', () => {
    const f: Record<string, any> = cancelBookingFields(given(), { reason: 'Wrong items', refund: null, at: AT }, false);
    expect(f).not.toHaveProperty('cancel_reason');
    expect(f.notes).toBe('Gift box · Cancelled: Wrong items');
    expect(bookingCancelReason({ status: 'cancelled', notes: f.notes })).toBe('Wrong items');
    expect(bookingCancelReason({ status: 'cancelled', cancel_reason: 'Twice', notes: '' })).toBe('Twice');
    expect(bookingCancelReason({ status: 'delivered', cancel_reason: 'x' })).toBeUndefined();
  });
  it('cancels a counter bill and nets the refund', () => {
    const f = cancelBillFields(bill(), { reason: 'Billed twice', refund: { amount: 4900, mode: 'cash' }, at: AT });
    expect(f).toMatchObject({ cancelled_at: AT, cancel_reason: 'Billed twice', paid_amount: 0, is_paid: true });
  });
});

describe('cancelled sales leave the money', () => {
  const cancelled = { ...given(), ...cancelBookingFields(given(), { reason: 'Not collected', refund: { amount: 4900, mode: 'upi' }, at: AT }, true) };
  it('is not due, not in the sheet balance or Packed/Given counts, and shows under Cancelled', () => {
    expect(bookingDue({ ...cancelled, advance_paid: 0 })).toBe(0);
    expect(owedBy('9428691130', [], [{ ...cancelled, advance_paid: 0 }]).amount).toBe(0);
    const sheet = buildSheet([cancelled], []);
    expect([sheet.total, sheet.balance]).toEqual([0, 0]);
    const rows = billRows([], [cancelled]);
    expect(rows[0]).toMatchObject({ stage: 'cancelled', cancelled: true, due: 0, cancelReason: 'Not collected', number: 'A9A931' });
    expect(billTotals(rows)).toMatchObject({ billed: 0, received: 0, due: 0, cancelled: 1 });
    expect(stageCounts(rows)).toMatchObject({ given: 0, cancelled: 1 });
    expect(filterBills(rows, NO_FILTER)).toEqual([]);
    expect(filterBills(rows, { ...NO_FILTER, stage: 'cancelled' })).toHaveLength(1);
  });
  it('takes the refund out of the day close', () => {
    const s = summarize([], [cancelled], '2026-11-05T00:00:00Z', '2026-11-07T00:00:00Z');
    expect(s.upi_total).toBe(0);
  });
});

describe('who may cancel or delete', () => {
  it('lets counter staff cancel and only owners delete', () => {
    expect([canCancelSale('owner'), canCancelSale('counter'), canCancelSale('kitchen')]).toEqual([true, true, false]);
    expect([canDeleteSale('owner'), canDeleteSale('counter'), canDeleteSale('kitchen')]).toEqual([true, false, false]);
  });
  it('says the sale goes to the recycle bin for 30 days', () => {
    expect(deleteMessage('Pre-booking #A9A931')).toBe('Pre-booking #A9A931 goes to the recycle bin for 30 days. You can restore it from Settings → Recycle bin.');
  });
  it('names a deleted counter bill in the bin', () => {
    const e = { id: 'x', kind: 'seasonal_orders', row_id: 'b1', label: 'Ramesh', data: bill({ total_amount: 980 }), deleted_at: AT };
    expect(binText(e)).toEqual({ title: 'Ramesh', line: 'Sweets bill · #7 · 5 Nov 2026 · ₹980' });
  });
});
