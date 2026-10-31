import { openWindow, summarize, countedOf, expectedOf, buildClose, shopDay, nextDay, differenceOf, DayClose } from './dayClose';
import { dayCloseSlipHtml } from './thermalSlips';
import { DEFAULT_DOC_SETTINGS } from './docs/settings';

const line = { item_id: 'k', item_name: 'Kaju Katli', weight: 500, weight_unit: 'gm' as const, price: 490, qty: 1, line_total: 490 };
const bill = (o: object) => ({ id: 'b', customer_name: 'A', phone: '', items: [line], subtotal: 490, discount_amount: 0, discount_type: 'amount',
  total_amount: 490, is_paid: true, payment_mode: 'cash', year: 2026, created_at: '2026-11-01T06:00:00Z', ...o }) as any;
const close = (o: Partial<DayClose>) => ({ id: 'c', day: '2026-10-31', closed_at: '2026-10-31T16:30:00Z', keep_cash: 2000, reopened_at: null, ...o }) as DayClose;

describe('day close', () => {
  it('rolls the shop day over at 4 am IST', () => {
    expect(shopDay(new Date('2026-11-01T19:00:00Z'))).toBe('2026-11-01'); // 00:30 IST on the 2nd still closes the 1st
    expect(shopDay(new Date('2026-11-02T00:00:00Z'))).toBe('2026-11-02'); // 5:30 am IST
    expect(nextDay('2026-12-31')).toBe('2027-01-01');
  });
  it('counts from the last close; after closing, money counts for the next day', () => {
    const now = new Date('2026-11-01T12:00:00Z');
    expect(openWindow([], now)).toMatchObject({ day: '2026-11-01', from: '2026-10-31T22:30:00.000Z' });
    expect(openWindow([close({})], now)).toMatchObject({ day: '2026-11-01', from: '2026-10-31T16:30:00Z' });
    expect(openWindow([close({ day: '2026-11-01', closed_at: '2026-11-01T11:00:00Z' })], now).day).toBe('2026-11-02');
    expect(openWindow([close({ day: '2026-11-01', reopened_at: 'x' })], now).day).toBe('2026-11-01');
  });
  it('splits cash by source and keeps UPI apart', () => {
    const from = '2026-11-01T00:00:00Z';
    const orders = [
      bill({ payments: [{ amount: 490, mode: 'cash', at: '2026-11-01T06:00:00Z', kind: 'sale' }] }),
      bill({ id: 'u', payments: [{ amount: 490, mode: 'upi', at: '2026-11-01T07:00:00Z', kind: 'sale' }] }),
      bill({ id: 'old', created_at: '2026-10-20T06:00:00Z', payments: [{ amount: 200, mode: 'cash', at: '2026-11-01T08:00:00Z', kind: 'due' }] }),
      bill({ id: 'open', is_paid: false, payment_mode: null }),
      bill({ id: 'x', cancelled_at: '2026-11-01T09:00:00Z', payments: [] }),
    ];
    const pre = [{ id: 'p', created_at: '2026-11-01T05:00:00Z', advance_paid: 800, status: 'delivered', total_amount: 900,
      payments: [{ amount: 300, mode: 'cash', at: '2026-11-01T05:00:00Z', kind: 'advance' }, { amount: 500, mode: 'cash', at: '2026-11-01T10:00:00Z', kind: 'handover' }] }] as any;
    const s = summarize(orders, pre, from, '2026-11-01T20:00:00Z');
    expect(s).toMatchObject({ cash_bills: 490, cash_dues: 200, cash_advances: 300, cash_handover: 500, cash: 1490, upi_total: 490, upi_count: 1, bills_count: 3, sales_total: 1470, unpaid_total: 490 });
    expect(summarize(orders, pre, '2026-11-01T09:30:00Z', '2026-11-01T20:00:00Z').cash).toBe(500);
  });
  it('counts notes and works out the drawer', () => {
    const notes = { '500': 3, '100': 4, '10': 2, coins: 7 };
    expect(countedOf(notes)).toBe(1927);
    expect(expectedOf(2000, { cash: 1490 }, 500)).toBe(2990);
    const w = openWindow([], new Date('2026-11-01T12:00:00Z'));
    const c = buildClose(w, summarize([], [], w.from, '2026-11-01T12:00:00Z'), { opening: 2000, cashOut: 0, cashOutNote: ' ', notes, keep: 1000, note: '' }, '2026-11-01T12:00:00Z');
    expect(c).toMatchObject({ day: '2026-11-01', expected_cash: 2000, counted_cash: 1927, cash_out_note: null, note: null });
    expect(differenceOf(c)).toBe(-73);
    const html = dayCloseSlipHtml(c, { settings: DEFAULT_DOC_SETTINGS, logo: '' });
    ['Day close', 'Should be in drawer', '₹2,000', 'Short', '₹73', '₹500 × 3', 'UPI received', 'Keep for tomorrow'].forEach(t => expect(html).toContain(t));
    expect(html).not.toContain('Pre-booking advances');
  });
});
