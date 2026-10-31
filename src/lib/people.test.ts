import { mergePeople, isSavedTwice, savedTwiceReason, personWithPhone, searchPeople, phoneKey, formatPhone, namesOf, initials } from './people';
import { summarize, recordsByPerson, filterCounts, matchesFilter, byMonth, dayLabel, Ctx } from './personHistory';
import type { Booking, Customer } from '../types';
import type { SeasonalCustomer } from '../hooks/useSeasonalCustomers';
import type { SeasonalOrder } from '../hooks/useSeasonalOrders';
import type { SeasonalPreorder } from '../hooks/useSeasonalPreorders';

const cust = (id: string, name: string, phone = '', extra: Partial<Customer> = {}): Customer =>
  ({ id, name, phone, address: '', created_at: '2026-05-01T10:00:00Z', ...extra });
const sweet = (id: string, name: string, phone = '', extra: Partial<SeasonalCustomer> = {}): SeasonalCustomer =>
  ({ id, name, phone, created_at: '2026-06-01T10:00:00Z', ...extra });
const booking = (id: string, customer_id: string, event_date: string, status: Booking['status'] = 'confirmed', event_type = 'Wedding'): Booking =>
  ({ id, customer_id, event_type, event_date, venue: 'Laxmi palace', guest_count: 200, status, estimated_cost: 100000, created_at: '2026-04-01T00:00:00Z' });
const bill = (id: string, phone: string, total: number, paid: boolean, at = '2026-10-30T08:00:00Z'): SeasonalOrder =>
  ({ id, bill_no: 5, customer_name: 'x', phone, items: [{ item_id: 'i', item_name: 'Kaju', weight: 500, weight_unit: 'gm', price: total, qty: 1, line_total: total }], subtotal: total, discount_amount: 0, discount_type: 'amount', total_amount: total, is_paid: paid, payment_mode: paid ? 'cash' : null, year: 2026, created_at: at });
const pre = (id: string, phone: string, total: number, advance: number, status: SeasonalPreorder['status'], date: string): SeasonalPreorder =>
  ({ id, customer_name: 'x', phone, items: [], subtotal: total, discount_amount: 0, discount_type: 'amount', total_amount: total, advance_paid: advance, payment_mode: 'cash', delivery_date: date, status, year: 2026, created_at: '2026-05-20T08:00:00Z' });

const ctx = (extra: Partial<Ctx> = {}): Ctx => ({ invoices: new Map(), worth: b => b.estimated_cost, today: '2026-10-31', ...extra });

describe('mergePeople', () => {
  const people = mergePeople(
    [cust('c1', 'Nikunj', '75671 87001'), cust('c2', 'Amit Shah', '9898989898', { email: 'amit@x.in' }), cust('c3', 'No Phone')],
    [sweet('s1', 'Nikuj Rana', '7567187001', { address: 'Navrangpura' }), sweet('s2', 'Krinal', '9173369688'), sweet('s3', 'Walk-in')],
  );

  it('joins catering and sweets records by mobile', () => {
    expect(people).toHaveLength(5 + 0);
    const nik = people.find(p => p.key === '7567187001')!;
    expect(nik.catering.map(c => c.id)).toEqual(['c1']);
    expect(nik.sweets.map(s => s.id)).toEqual(['s1']);
    expect(nik.name).toBe('Nikunj');
    expect(nik.address).toBe('Navrangpura');
  });

  it('keeps records without a mobile on their own and sorts by name', () => {
    expect(people.map(p => p.name)).toEqual(['Amit Shah', 'Krinal', 'Nikunj', 'No Phone', 'Walk-in']);
    expect(people.find(p => p.name === 'No Phone')!.key).toBe('c:c3');
  });

  it('flags a person saved under two names', () => {
    const nik = people.find(p => p.key === '7567187001')!;
    expect(isSavedTwice(nik)).toBe(true);
    expect(savedTwiceReason(nik)).toBe('once for catering, once for sweets');
    expect(namesOf(nik)).toHaveLength(2);
    expect(people.filter(isSavedTwice)).toHaveLength(1);
  });

  it('does not flag the same name saved in both lists', () => {
    const [p] = mergePeople([cust('c1', 'Kaumil', '9000000001')], [sweet('s1', ' kaumil ', '9000000001')]);
    expect(isSavedTwice(p)).toBe(false);
  });

  it('flags two catering records with one mobile', () => {
    const [p] = mergePeople([cust('a', 'Rahul', '9000000002'), cust('b', 'Rahul', '9000000002')], []);
    expect(isSavedTwice(p)).toBe(true);
    expect(savedTwiceReason(p)).toBe('2 times for catering');
  });

  it('finds an existing person by mobile, skipping the one being edited', () => {
    expect(personWithPhone(people, '+91 75671-87001')?.name).toBe('Nikunj');
    expect(personWithPhone(people, '7567187001', '7567187001')).toBeUndefined();
    expect(personWithPhone(people, '123')).toBeUndefined();
  });

  it('searches by name, any saved name, email and mobile digits', () => {
    expect(searchPeople(people, 'rana').map(p => p.name)).toEqual(['Nikunj']);
    expect(searchPeople(people, 'amit@').map(p => p.name)).toEqual(['Amit Shah']);
    expect(searchPeople(people, '9173').map(p => p.name)).toEqual(['Krinal']);
    expect(searchPeople(people, '')).toHaveLength(5);
  });

  it('formats mobiles and initials', () => {
    expect(phoneKey('075671 87001')).toBe('7567187001');
    expect(formatPhone('7567187001')).toBe('75671 87001');
    expect(initials('Kanubhai patel')).toBe('KP');
    expect(initials('')).toBe('?');
  });
});

describe('summarize', () => {
  const people = mergePeople([cust('c1', 'Kaumil', '9000000001'), cust('c2', 'Amit', '9000000003')], [sweet('s1', 'Nikuj', '7567187001')]);
  const records = recordsByPerson(people,
    [booking('b1', 'c1', '2026-05-19'), booking('b2', 'c2', '2026-12-05', 'inquiry'), booking('b3', 'c2', '2026-11-01'), booking('b4', 'c2', '2026-01-10', 'cancelled')],
    [bill('o1', '75671 87001', 7350, false), bill('o2', '9000000009', 50, true)],
    [pre('p1', '9000000001', 1920, 1920, 'delivered', '2026-05-28')]);

  it('files bookings by customer and sweets by mobile', () => {
    expect(records.get('9000000001')!.bookings.map(b => b.id)).toEqual(['b1']);
    expect(records.get('9000000001')!.preorders.map(p => p.id)).toEqual(['p1']);
    expect(records.get('7567187001')!.bills.map(b => b.id)).toEqual(['o1']);
  });

  it('adds up catering, sweets, not invoiced and spots a stale confirmed event', () => {
    const kaumil = people.find(p => p.name === 'Kaumil')!;
    const s = summarize(kaumil, records.get(kaumil.key), ctx());
    expect(s.sides).toEqual(['catering', 'sweets']);
    expect(s.catering).toBe(100000);
    expect(s.cateringNote).toBe('1 wedding');
    expect(s.sweets).toBe(1920);
    expect(s.sweetsNote).toBe('1 pre-booking');
    expect(s.notInvoiced).toBe(100000);
    expect(s.notInvoicedNote).toBe('Wedding 19 May');
    expect(s.stale.map(b => b.id)).toEqual(['b1']);
    expect(s.lastSeen).toBe('2026-05-28');
    expect(s.next).toBeNull();
    expect(s.line).toBe('Wedding 19 May · Pre-booking 28 May');
    expect(s.owes).toBe(0);
  });

  it('counts an unpaid sweets bill as owed', () => {
    const nik = people.find(p => p.name === 'Nikuj')!;
    const s = summarize(nik, records.get(nik.key), ctx());
    expect(s.sides).toEqual(['sweets']);
    expect(s.owes).toBe(7350);
    expect(s.owesNote).toBe('Sweets bill #5');
    expect(s.history[0]).toMatchObject({ status: 'Unpaid', tone: 'red', line: '1 item · not paid yet' });
    expect(s.line).toBe('Sweets bill 30 Oct');
  });

  it('counts invoice balances and leaves cancelled bookings out', () => {
    const amit = people.find(p => p.name === 'Amit')!;
    const invoices = new Map([['b3', { booking_id: 'b3', balance_due: 5000, invoice_number: 'INV-7' }]]);
    const s = summarize(amit, records.get(amit.key), ctx({ invoices }));
    expect(s.catering).toBe(200000);
    expect(s.cateringNote).toBe('2 events');
    expect(s.owes).toBe(5000);
    expect(s.notInvoiced).toBe(0);
    expect(s.next?.id).toBe('b3');
    expect(s.line).toBe('2 events · next 1 Nov');
    expect(s.history.find(h => h.id === 'b4')).toMatchObject({ status: 'Cancelled', due: 0 });
  });

  it('counts people per filter', () => {
    const list = people.map(p => summarize(p, records.get(p.key), ctx({ invoices: new Map([['b3', { booking_id: 'b3', balance_due: 1, invoice_number: 'I' }]]) })));
    expect(filterCounts(list)).toEqual({ all: 3, catering: 2, sweets: 2, owes: 2 });
    expect(matchesFilter(list[0], 'all')).toBe(true);
  });

  it('groups history by month and labels days', () => {
    const kaumil = people.find(p => p.name === 'Kaumil')!;
    const months = byMonth(summarize(kaumil, records.get(kaumil.key), ctx()).history);
    expect(months.map(m => m.month)).toEqual(['MAY 2026']);
    expect(months[0].items.map(i => i.id)).toEqual(['p1', 'b1']);
    expect(dayLabel('2027-02-26', '2026-10-31')).toBe('26 Feb 2027');
  });
});
