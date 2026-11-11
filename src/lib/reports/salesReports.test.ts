import { ReportInput } from './input';
import { summaryReport, registerReport, customersReport, itemDayReport } from './salesDetail';
import { hoursReport, discountsReport } from './salesTime';
import { salesOf, totalsOf, previousRange, lastYearRange, change } from './sales';
import { reportCsv } from './export';

const kaju = { item_id: 'k', item_name: 'Kaju Katli', weight: 500, weight_unit: 'gm' as const, price: 490, qty: 2, line_total: 980 };
const modak = { item_id: 'p', item_name: 'Modak', weight: 6, weight_unit: 'pc' as const, price: 120, qty: 1, line_total: 120 };
const pay = (amount: number, mode: 'cash' | 'upi', at: string, kind = 'sale') => ({ amount, mode, at, kind });
const bill = (o: object) => ({ id: 'b1', bill_no: 1, customer_name: 'Ramesh', phone: '9824012345', items: [kaju], subtotal: 980, discount_amount: 0,
  discount_type: 'amount', total_amount: 980, is_paid: true, payment_mode: 'cash', year: 2026, created_at: '2026-10-20T13:00:00Z',
  payments: [pay(980, 'cash', '2026-10-20T13:00:00Z')], ...o }) as any;

const orders = [
  bill({}),
  bill({ id: 'b2', bill_no: 2, customer_name: 'Walk-in', phone: '', items: [modak], subtotal: 120, total_amount: 120, created_at: '2026-10-21T05:00:00Z', payments: [pay(120, 'upi', '2026-10-21T05:00:00Z')] }),
  bill({ id: 'b3', bill_no: 3, subtotal: 980, discount_amount: 80, total_amount: 900, created_at: '2026-10-21T13:30:00Z', is_paid: false, payments: [pay(400, 'cash', '2026-10-21T13:30:00Z')] }),
  bill({ id: 'b4', bill_no: 4, cancelled_at: '2026-10-22T06:00:00Z', cancel_reason: 'Wrong item', created_at: '2026-10-22T05:00:00Z',
    payments: [pay(980, 'upi', '2026-10-22T05:00:00Z'), pay(-980, 'upi', '2026-10-22T06:00:00Z', 'refund')] }),
];
const input = (o: Partial<ReportInput> = {}): ReportInput => ({
  range: { from: '2026-10-15', to: '2026-10-28' }, today: '2026-10-31', occasionId: '', orders, unpaidOrders: [], preorders: [], items: [], occasions: [],
  invoices: [], payments: [], bookings: [], bookingValue: () => 0, ...o,
});

describe('sales building blocks', () => {
  it('turns bills into sales and adds up a period', () => {
    const t = totalsOf(salesOf(input(), input().range));
    expect(t).toMatchObject({ gross: 2080, discount: 80, net: 2000, sales: 3, avg: 667, cancelled: 1, cancelledValue: 980, refunds: 980, cash: 1380, upi: 120, credit: 500 });
    expect(t.qty).toBe('2 kg, 6 pcs');
  });
  it('finds the period before and the same dates last year', () => {
    expect(previousRange({ from: '2026-10-15', to: '2026-10-28' })).toEqual({ from: '2026-10-01', to: '2026-10-14' });
    expect(lastYearRange({ from: '2028-02-29', to: '2028-03-05' })).toEqual({ from: '2027-02-28', to: '2027-03-05' });
    expect([change(118, 100), change(90, 100), change(5, 0)]).toEqual(['+18%', '−10%', '']);
  });
});

describe('detailed sales reports', () => {
  it('compares the summary with earlier periods', () => {
    const r = summaryReport(input({ compare: { previous: [bill({ created_at: '2026-10-05T06:00:00Z' })], lastYear: [] } }));
    const net = r.tables[0].rows.find(x => x.m === 'Net sales')!;
    expect(net).toMatchObject({ now: '₹2,000', prev: '₹980', pc: '+104%', last: '₹0', lc: '' });
  });
  it('lists every bill, cancelled ones without adding them', () => {
    const r = registerReport(input());
    expect(r.tables[0].rows).toHaveLength(4);
    expect(r.tables[0].rows[0].status).toBe('Cancelled · Wrong item');
    expect(r.tables[0].total).toMatchObject({ total: 2000, paid: 1500, due: 500 });
  });
  it('groups customers by mobile with walk-ins as one row', () => {
    const rows = customersReport(input()).tables[0].rows;
    expect(rows.map(x => [x.name, x.bills, x.sales])).toEqual([['Ramesh', 2, 1880], ['Walk-in', 1, 120]]);
  });
  it('spreads quantities over the days', () => {
    const t = itemDayReport(input()).tables[0];
    expect(t.cols.map(c => c.label)).toContain('20 Oct 2026');
    expect(t.rows[0]).toMatchObject({ name: 'Kaju Katli', '2026-10-20': '1 kg', '2026-10-21': '1 kg', total: '2 kg' });
  });
  it('splits counter bills by IST hour and weekday', () => {
    const r = hoursReport(input());
    expect(r.tables[0].rows.map(x => x.hour)).toEqual(['10 AM – 11 AM', '6 PM – 7 PM', '7 PM – 8 PM']);
    expect(r.tables[1].rows.map(x => x.day)).toEqual(['Tuesday', 'Wednesday']);
  });
  it('lists discounts, cancellations and refunds', () => {
    const r = discountsReport(input());
    expect(r.tables[0].rows.map(x => [x.what, x.amount])).toEqual([['Refund on cancel', 980], ['Cancelled', 980], ['Discount 8.2%', 80]]);
    expect(reportCsv(r, input().range)).toContain('Wrong item');
  });
});
