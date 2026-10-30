import { presetRange, addDays, bucketOf, fmtCell } from './model';
import { ReportInput } from './input';
import { salesReport, itemsReport, categoryReport, topReport } from './sweets';
import { paymentsReport, duesReport } from './money';
import { preorderReport, cateringReport } from './pipeline';
import { reportCsv, reportHtml } from './export';
import { buildSheet } from '../preorderSheet';
import { preorderSlipHtml } from '../docs/sweetsDocs';
import { preorderReceipt } from '../sessionalReceipts';

const kaju = { item_id: 'k', item_name: 'Kaju Katli', weight: 500, weight_unit: 'gm' as const, price: 490, qty: 2, line_total: 980 };
const pcs = { item_id: 'p', item_name: 'Modak', weight: 6, weight_unit: 'pc' as const, price: 120, qty: 1, line_total: 120 };
const bill = (o: object) => ({ id: 'b1xxxxxx', bill_no: 1, customer_name: 'Ramesh', phone: '9824012345', items: [kaju], subtotal: 980, discount_amount: 0,
  discount_type: 'amount' as const, total_amount: 980, is_paid: true, payment_mode: 'cash' as const, year: 2026, created_at: '2026-10-20T06:00:00Z', ...o });
const pre = (o: object) => ({ id: 'p1xxxxxx', customer_name: 'Sita', phone: '9898989898', items: [kaju, pcs], subtotal: 1100, discount_amount: 0,
  discount_type: 'amount' as const, total_amount: 1100, advance_paid: 300, payment_mode: 'upi' as const, status: 'pending' as const,
  delivery_date: '2026-10-25', year: 2026, created_at: '2026-10-10T06:00:00Z', ...o });

const input = (o: Partial<ReportInput> = {}): ReportInput => ({
  range: { from: '2026-10-01', to: '2026-10-31' }, today: '2026-10-31', occasionId: '',
  orders: [bill({}), bill({ id: 'b2xxxxxx', is_paid: false, payment_mode: null, total_amount: 120, items: [pcs] })],
  unpaidOrders: [bill({ id: 'b2xxxxxx', is_paid: false, payment_mode: null, total_amount: 120, items: [pcs] })],
  preorders: [
    pre({}),
    pre({ id: 'p2xxxxxx', status: 'delivered', advance_paid: 1100, balance_paid: 800, balance_mode: 'cash', delivered_at: '2026-10-24T08:00:00Z' }),
    pre({ id: 'p3xxxxxx', status: 'cancelled' }),
  ] as any,
  items: [{ id: 'k', name: 'Kaju Katli', category: 'Dry fruit' }, { id: 'p', name: 'Modak', category: null }] as any,
  occasions: [], invoices: [], payments: [], bookings: [], bookingValue: () => 0,
  ...o,
});

describe('report ranges', () => {
  it('builds presets in IST days', () => {
    expect(presetRange('lastMonth', '2026-03-15')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(presetRange('fy', '2026-03-15')).toEqual({ from: '2025-04-01', to: '2026-03-15' });
    expect(presetRange('week', '2026-10-03')).toEqual({ from: '2026-09-27', to: '2026-10-03' });
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
  it('switches to months for long ranges', () => {
    expect(bucketOf({ from: '2026-01-01', to: '2026-12-31' }).label).toBe('Month');
    expect(bucketOf({ from: '2026-10-01', to: '2026-10-31' }).label).toBe('Date');
    expect(fmtCell(1234.5, 'money')).toBe('₹1,234.5');
  });
});

describe('sweets reports', () => {
  it('counts bills plus handed-over pre-bookings as sales', () => {
    const r = salesReport(input());
    expect(r.stats[0].value).toBe(980 + 120 + 1100);
    expect(r.tables[0].total).toMatchObject({ bills: 2, given: 1, total: 2200 });
    expect(r.tables[0].rows.map(x => x.day)).toEqual(['20 Oct 2026', '24 Oct 2026']);
  });
  it('totals items by weight and pack, with categories', () => {
    const r = itemsReport(input());
    const k = r.tables[0].rows.find(x => x.name === 'Kaju Katli')!;
    expect(k).toMatchObject({ cat: 'Dry fruit', packs: 4, qty: '2 kg', revenue: 1960 });
    expect(categoryReport(input()).tables[0].rows.map(x => x.name)).toEqual(['Dry fruit', 'Uncategorised']);
    expect(topReport(input()).tables[1].rows[0]).toMatchObject({ name: 'Ramesh', bills: 2, spend: 1100 });
  });
});

describe('money reports', () => {
  it('splits receipts by mode and source', () => {
    const r = paymentsReport(input());
    const rows = Object.fromEntries(r.tables[0].rows.map(x => [x.mode, x]));
    // 980 cash bill + 800 cash at hand-over; advances 300 UPI each for the live bookings.
    expect(rows.Cash).toMatchObject({ bills: 980, handover: 800, total: 1780 });
    expect(rows.UPI).toMatchObject({ advance: 600, total: 600 });
    expect(r.stats[0].value).toBe(2380);
  });
  it('lists dues as of today', () => {
    const r = duesReport(input());
    expect(r.stats[0].value).toBe(120 + 800);
    expect(r.tables[1].rows).toHaveLength(1);
  });
});

describe('pipeline reports', () => {
  it('summarises pre-bookings due in the period', () => {
    const r = preorderReport(input());
    expect(r.stats[0].value).toBe(2200);
    expect(r.tables[2].rows).toEqual([{ name: 'Kaju Katli', qty: '1 kg', packs: 2 }, { name: 'Modak', qty: '6 pcs', packs: 1 }]);
  });
  it('values catering events in the period', () => {
    const b = { id: 'e1', customer_id: 'c1', customer: { name: 'Kavit' }, event_type: 'Wedding', event_date: '2026-10-28', guest_count: 200, status: 'confirmed', estimated_cost: 0 };
    const inv = { booking_id: 'e1', total_amount: 50000, advance_paid: 20000, balance_due: 30000 };
    const r = cateringReport(input({ bookings: [b] as any, invoices: [inv] as any, bookingValue: () => 50000, payments: [{ amount: 20000, payment_date: '2026-10-29', payment_mode: 'upi' }] as any }));
    expect(r.stats.map(s => s.value)).toEqual([50000, 50000, 20000, 30000]);
  });
  it('exports CSV and printable HTML', () => {
    const r = salesReport(input());
    expect(reportCsv(r, input().range)).toContain('Day by day\nDate,Bills,Counter sales');
    expect(reportHtml(r, input().range)).toContain('>Sales report</div>');
  });
});

describe('pre-booking sheet and slip', () => {
  it('lays out customers by sweets with column totals', () => {
    const s = buildSheet(input().preorders, input().items);
    expect(s.columns.map(c => c.name)).toEqual(['Kaju Katli', 'Modak']);
    expect(s.columns[0]).toMatchObject({ amount: 2000, packs: 4 }); // cancelled one left out
    expect(s.rows[0].cells['kaju katli|kg']).toBe('500 g × 2');
    expect(s.balance).toBe(800);
  });
  it('prints every payment detail on the slip', () => {
    const html = preorderSlipHtml(preorderReceipt(input().preorders[1], 'Diwali', '24ABCDE1234F1Z5'));
    ['Pre-booking', 'Sita', '9898989898', 'Pickup', 'Advance · UPI', 'Paid at hand-over · Cash', 'Fully paid', 'Customer signature', 'Diwali', 'counter stub']
      .forEach(t => expect(html).toContain(t));
  });
});
