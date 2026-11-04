import { billRows, filterBills, billTotals, stageCounts, freshFilter, isOverdue, NO_FILTER, BillFilter } from './billList';
import { sweetsInvoiceDoc } from './docs/sweetsInvoice';
import { DEFAULT_DOC_SETTINGS } from './docs/settings';
import { presetSpan } from './preorders';

const AT = '2026-11-01T10:00:00.000Z';
const line = { item_id: 'k', item_name: 'Kaju Katli', weight: 500, weight_unit: 'gm' as const, price: 490, qty: 2, line_total: 980 };
const bill = (o: object = {}) => ({ id: 'b1', bill_no: 7, customer_name: 'Ramesh', phone: '9824012345', items: [line], subtotal: 980, discount_amount: 0,
  discount_type: 'amount' as const, total_amount: 980, is_paid: true, payment_mode: 'cash' as const, year: 2026, created_at: AT, occasion_id: 'diwali', ...o }) as any;
const booking = (o: object = {}) => ({ id: 'abcdef12', customer_name: 'Sita', phone: '9898989898', items: [line], subtotal: 980, discount_amount: 0,
  discount_type: 'amount' as const, total_amount: 980, advance_paid: 300, payment_mode: 'upi' as const, status: 'pending' as const, year: 2026,
  created_at: AT, delivery_date: '2026-11-05', occasion_id: 'diwali', ...o }) as any;
const rows = billRows([bill(), bill({ id: 'b2', bill_no: 8, cancelled_at: AT, occasion_id: 'holi' })], [booking()]);
const only = (f: Partial<BillFilter>) => filterBills(rows, { ...NO_FILTER, stage: 'all', ...f }).map(r => r.number);

describe('bills list', () => {
  it('lists counter bills and pre-bookings together, newest first', () => {
    expect(rows.map(r => [r.kind, r.number, r.day])).toEqual([['booking', 'ABCDEF', '2026-11-05'], ['bill', '7', '2026-11-01'], ['bill', '8', '2026-11-01']]);
    expect(rows[0]).toMatchObject({ paid: 300, due: 680, mode: 'upi', stage: 'booked' });
  });
  it('filters by date, occasion, kind, paid state, mode and search', () => {
    expect(only({ span: { from: '2026-11-02', to: '' } })).toEqual(['ABCDEF']);
    expect(only({ occasion: 'holi' })).toEqual(['8']);
    expect(only({ type: 'bill' })).toEqual(['7', '8']);
    expect(only({ pay: 'unpaid' })).toEqual(['ABCDEF']);
    expect(only({ pay: 'paid' })).toEqual(['7']);
    expect(only({ stage: 'cancelled' })).toEqual(['8']);
    expect(only({ stage: 'booked' })).toEqual(['ABCDEF']);
    expect(only({ mode: 'upi' })).toEqual(['ABCDEF']);
    expect(only({ q: '#7' })).toEqual(['7']);
    expect(only({ q: '98989' })).toEqual(['ABCDEF']);
  });
  it('shows given sales by default and counts each stage', () => {
    expect(filterBills(rows, NO_FILTER).map(r => r.number)).toEqual(['7']);
    const more = billRows([], [booking({ id: 'p2', status: 'ready' }), booking({ id: 'p3', status: 'delivered', delivered_at: AT })]);
    expect(stageCounts([...rows, ...more])).toEqual({ all: 5, booked: 1, packed: 1, given: 2, cancelled: 1 });
    expect(isOverdue(more[0], '2026-11-06')).toBe(true);
    expect(isOverdue(more[1], '2026-11-06')).toBe(false);
  });
  it('works a remembered quick range out again for today', () => {
    const kept = { ...NO_FILTER, preset: 'today' as const, span: { from: '2026-10-01', to: '2026-10-01' } };
    expect(freshFilter(kept, '2026-11-04').span).toEqual({ from: '2026-11-04', to: '2026-11-04' });
    const custom = { ...kept, preset: 'custom' as const };
    expect(freshFilter(custom, '2026-11-04').span).toEqual(kept.span);
  });
  it('adds up what is shown, leaving cancelled bills out of the money', () => {
    expect(billTotals(rows)).toEqual({ count: 3, cancelled: 1, billed: 1960, received: 1280, due: 680 });
  });
  it('has past ranges for bill dates', () => {
    expect(presetSpan('yesterday', '2026-11-04')).toEqual({ from: '2026-11-03', to: '2026-11-03' });
    expect(presetSpan('last7', '2026-11-04')).toEqual({ from: '2026-10-29', to: '2026-11-04' });
    expect(presetSpan('month', '2026-11-04')).toEqual({ from: '2026-11-01', to: '2026-11-04' });
  });
});

describe('sweets invoice', () => {
  const ctx = { settings: { ...DEFAULT_DOC_SETTINGS, bank: 'HDFC Bank · A/c 1234 · IFSC HDFC0001', upi_id: 'shop@upi', sweets_gst_rate: 5 }, gstNumber: '24ABCDE1234F1Z5', logo: '' };
  it('prints items, included GST, payments, balance, bank, QR and terms', () => {
    const doc = sweetsInvoiceDoc(rows[0], 'Diwali', ctx);
    ['Tax invoice', '#ABCDEF', 'Sita', 'Kaju Katli', '500 g', 'CGST @2.5% (included)', 'Advance', 'Balance due', '₹680', 'HDFC Bank', 'shop@upi', 'UPI QR code', 'Goods once sold', 'Authorised signatory', 'Diwali']
      .forEach(t => expect(doc.html).toContain(t));
    expect(doc.fileName).toBe('Invoice_ABCDEF_Sita.pdf');
  });
  it('marks cancelled bills without a QR, leaves tax out without a GSTIN, and paid ones get an open-amount QR', () => {
    const doc = sweetsInvoiceDoc(rows[2], undefined, { ...ctx, gstNumber: undefined });
    expect(doc.html).toContain('Cancelled');
    expect(doc.html).not.toContain('Tax invoice');
    expect(doc.html).not.toContain('UPI QR code');
    expect(sweetsInvoiceDoc(rows[1], undefined, ctx).html).toContain('Scan to pay by UPI');
  });
});
