import { seasonRange, periodRange, receiptsIn, receivedSummary, debtsOf, ageBuckets, comingIn, monthBars, fyStart, MoneyData } from './moneyView';
import { caReport } from './caExport';

const TODAY = '2026-10-31';
const booking = (id: string, status: string, event_date: string, name = id): any => ({ id, status, event_date, event_type: 'Vashtu', guest_count: 100, customer: { name, phone: '9876543210' } });
const invoice = (id: string, b: any, total: number, paid: number): any => ({
  id, booking_id: b.id, booking: b, invoice_number: `INV-${id}`, total_amount: total, advance_paid: paid, balance_due: total - paid, gst_amount: 0, issue_date: '2026-09-14', status: paid ? 'sent' : 'draft',
});
const pay = (id: string, invoice_id: string, amount: number, payment_date: string, payment_mode = 'cash'): any => ({ id, invoice_id, amount, payment_date, payment_mode, payment_type: 'advance' });

const jigar = booking('j', 'confirmed', '2026-09-13', 'Jigar bhai');
const gone = booking('x', 'cancelled', '2026-10-01', 'Gone');
const data: MoneyData = {
  bookings: [jigar, gone, booking('a', 'confirmed', '2026-12-05', 'Amit'), booking('k', 'inquiry', '2026-11-25', 'Kavit'), booking('n', 'completed', '2026-05-07', 'Nayan')],
  invoices: [invoice('1', jigar, 116675, 50000), invoice('2', gone, 20000, 5000)],
  payments: [pay('p1', '1', 50000, '2026-09-14'), pay('p2', '2', 5000, '2026-10-02')],
  quotes: [
    { id: 'q1', booking_id: 'a', status: 'accepted', quotation_number: 'Q1', total_amount: 37000, created_at: '2026-10-01' },
    { id: 'q2', booking_id: 'k', status: 'sent', quotation_number: 'Q2', total_amount: 28800, total_max: 31600, created_at: '2026-10-01' },
    { id: 'q3', booking_id: 'n', status: 'draft', quotation_number: 'Q3', total_amount: 114300, created_at: '2026-04-01' },
  ],
  orders: [
    { id: 'o1', bill_no: 5, customer_name: 'Nikuj Rana', phone: '9800000000', items: [{ item_name: 'Kaju Katli' }], total_amount: 7350, is_paid: false, payment_mode: null, created_at: '2026-10-30T10:00:00Z', payments: [] } as any,
    { id: 'o2', bill_no: 4, customer_name: 'Paid', phone: '', items: [], total_amount: 500, is_paid: true, payment_mode: 'upi', created_at: '2026-10-29T10:00:00Z' } as any,
  ],
  preorders: [{ id: 'p', customer_name: 'Kaumil', phone: '', items: [{ item_name: 'Kaju Katli' }], total_amount: 1920, advance_paid: 1920, status: 'pending', payment_mode: 'cash', created_at: '2026-05-28T06:00:00Z' } as any],
};

describe('periods', () => {
  it('uses the Apr–Mar year, Monday weeks and a picked range', () => {
    expect(fyStart('2026-10-31')).toBe('2026-04-01');
    expect(fyStart('2027-02-01')).toBe('2026-04-01');
    expect(periodRange('year', TODAY)).toEqual({ from: '2026-04-01', to: TODAY });
    expect(periodRange('week', TODAY)).toEqual({ from: '2026-10-26', to: TODAY });
    expect(periodRange('month', TODAY)).toEqual({ from: '2026-10-01', to: TODAY });
    expect(periodRange('season', TODAY, { from: '2026-10-25', to: '2026-11-08' })).toEqual({ from: '2026-10-25', to: '2026-11-08' });
    expect(periodRange('custom', TODAY, null, { from: '2026-10-10', to: '2026-10-01' })).toEqual({ from: TODAY, to: TODAY });
  });
  it('takes the running season, cut at today', () => {
    const occ = [{ name: 'Rakhi', is_active: false, start_date: '2026-08-01', end_date: '2026-08-20' }, { name: 'Diwali 2026', is_active: true, start_date: '2026-10-25', end_date: '2026-11-08' }, { name: 'No dates', is_active: true }];
    expect(seasonRange(occ, TODAY)).toEqual({ from: '2026-10-25', to: TODAY, name: 'Diwali 2026' });
    expect(seasonRange(occ.slice(0, 1), TODAY)).toEqual({ from: '2026-08-01', to: '2026-08-20', name: 'Rakhi' });
    expect(seasonRange([], TODAY)).toBeNull();
  });
});

describe('money in', () => {
  it('leaves out payments on cancelled bookings and tags sources and modes', () => {
    const list = receiptsIn(data, { from: '2026-04-01', to: TODAY });
    expect(list.map(x => x.amount)).toEqual([500, 50000, 1920]);
    expect(list[1]).toMatchObject({ who: 'Jigar bhai', what: 'advance for Vashtu (INV-1)', source: 'catering', mode: 'cash' });
    expect(receivedSummary(list)).toMatchObject({ total: 52420, catering: 50000, sweets: 2420, upi: 500 });
  });
  it('splits each month of the year into catering and sweets', () => {
    const bars = monthBars(data, '2026-04-01');
    expect(bars).toHaveLength(12);
    expect(bars[0].label).toBe('Apr');
    expect(bars.find(b => b.ym === '2026-09')).toMatchObject({ catering: 50000, sweets: 0 });
    expect(bars.find(b => b.ym === '2026-05')).toMatchObject({ catering: 0, sweets: 1920 });
  });
});

describe('money owed and coming', () => {
  it('lists who owes, oldest first, in age buckets', () => {
    const list = debtsOf(data, TODAY);
    expect(list.map(x => [x.name, x.amount, x.days])).toEqual([['Jigar bhai', 66675, 48], ['Nikuj Rana', 7350, 1]]);
    expect(ageBuckets(list)).toEqual([0, 7350, 66675, 0]);
  });
  it('counts booked, sent and draft quotes for upcoming events only', () => {
    const c = comingIn(data, TODAY);
    expect(c.booked).toEqual({ count: 1, value: 37000 });
    expect(c.sent).toMatchObject({ count: 1, low: 28800, high: 31600, names: ['Kavit'] });
    expect(c.drafts.count).toBe(0);
    expect(c.past.count).toBe(1);
  });
  it('keeps a confirmed event with a sent, unaccepted quote as a quote', () => {
    const d = { ...data, bookings: [...data.bookings, booking('kc', 'confirmed', '2026-11-25', 'Kavit')], quotes: [...data.quotes, { id: 'q4', booking_id: 'kc', status: 'sent', quotation_number: 'Q4', total_amount: 100, created_at: '' }] };
    const c = comingIn(d, TODAY);
    expect(c.booked.count).toBe(1);
    expect(c.sent.count).toBe(2);
    expect(c.ready.map(r => r.booking.id)).toEqual(['a']);
  });
  it('builds the CA file parts', () => {
    const r = caReport(data, [{ id: 's', spent_on: '2026-09-13', amount: 4200, kind: 'Groceries', scope: 'event', booking_id: 'j', mode: 'cash', created_at: '' }], { from: '2026-04-01', to: TODAY }, TODAY, ['sales', 'payments', 'spends']);
    expect(r.tables.map(t => t.title)).toEqual(['Sales register', 'Payments received', 'Spends']);
    expect(r.tables[0].rows.map(x => x.no)).toEqual(['INV-1', 'Bill #4', 'Bill #5']);
    expect(r.stats[2].value).toBe(4200);
    expect(r.tables[2].rows[0].for).toContain('Jigar bhai');
  });
});
