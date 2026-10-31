import type { SeasonalOrder, SeasonalOrderItem } from '../hooks/useSeasonalOrders';
import type { SeasonalPreorder } from '../hooks/useSeasonalPreorders';
import {
  makePlan, datesShort, linesText, looksLikeTest, dueList, unpaidOf, bookedOf, seasonSoFar, amountText, addDays,
} from './sweetsToday';

const line = (item_name: string, weight: number, qty = 1): SeasonalOrderItem =>
  ({ item_id: item_name, item_name, weight, weight_unit: 'gm', price: 100, qty, line_total: 100 * qty });

const pre = (id: string, delivery_date: string | undefined, items: SeasonalOrderItem[], o: Partial<SeasonalPreorder> = {}): SeasonalPreorder => ({
  id, customer_name: id, phone: '', items, subtotal: 0, discount_amount: 0, discount_type: 'amount', total_amount: 1000,
  advance_paid: 0, payment_mode: null, delivery_date, status: 'pending', year: 2026, created_at: '2026-10-20T05:00:00Z', ...o,
});

const bill = (id: string, created_at: string, total: number, o: Partial<SeasonalOrder> = {}): SeasonalOrder => ({
  id, customer_name: id, phone: '', items: [line('Kaju Katli', 500)], subtotal: total, discount_amount: 0, discount_type: 'amount',
  total_amount: total, is_paid: true, payment_mode: 'cash', year: 2026, created_at, ...o,
});

describe('what to make', () => {
  const list = [
    pre('Krinal', '2026-11-04', [line('Khajur Pak', 250, 56), line('Fancy Mix Mava', 500)]),
    pre('data', '2026-11-04', [line('Kaju Katli', 500), line('Kaju Anjir Roll', 500), line('Mohanthal', 500)], { status: 'confirmed' }),
    pre('Rahul', '2026-11-09', [line('Kaju Anjir Roll', 1000), line('Halwasan', 1000), line('Kopra Pak', 750), line('Fancy Mix Mava', 750)]),
    pre('Packed', '2026-11-04', [line('Magas', 1000)], { status: 'ready' }),
    pre('Later', '2026-11-12', [line('Magas', 1000)]),
    pre('Gone', '2026-10-30', [line('Magas', 1000)]),
  ];

  it('totals booked sweets by delivery day for the next 10 days', () => {
    const plan = makePlan(list, '2026-10-31');
    expect(plan.dates).toEqual(['2026-11-04', '2026-11-09']);
    expect(plan.rows.map(r => r.name)).toEqual(['Khajur Pak', 'Kaju Anjir Roll', 'Fancy Mix Mava', 'Halwasan', 'Kopra Pak', 'Kaju Katli', 'Mohanthal']);
    const [khajur, anjir] = plan.rows;
    expect(khajur).toMatchObject({ total: 14000, packs: '56 × 250 g', byDate: { '2026-11-04': 14000 } });
    expect(anjir).toMatchObject({ total: 1500, packs: '' });
    expect(amountText(khajur.total, khajur.unit)).toBe('14 kg');
    expect(amountText(plan.rows[2].total, 'kg')).toBe('1.25 kg');
    expect(amountText(anjir.byDate['2026-11-01'], 'kg')).toBe('—');
  });

  it('stops after the last day', () => {
    expect(makePlan(list, '2026-10-31', 4).dates).toEqual([]);
    expect(addDays('2026-10-31', 9)).toBe('2026-11-09');
  });

  it('writes short date lists', () => {
    expect(datesShort(['2026-11-04'])).toBe('4 Nov');
    expect(datesShort(['2026-11-04', '2026-11-09'])).toBe('4 and 9 Nov');
    expect(datesShort(['2026-11-04', '2026-11-06', '2026-11-09'])).toBe('4, 6 and 9 Nov');
    expect(datesShort(['2026-10-30', '2026-11-04'])).toBe('30 Oct and 4 Nov');
  });
});

describe('pre-bookings due', () => {
  it('writes what was booked', () => {
    expect(linesText([line('Khajur Pak', 250, 56), line('Fancy Mix Mava', 500)])).toBe('Khajur Pak 56 × 250 g · Fancy Mix Mava 500 g');
    expect(linesText([line('Kaju Katli', 500), line('Mohanthal', 500)])).toBe('Kaju Katli · Mohanthal, 500 g each');
    expect(linesText([line('Halwasan', 1000)])).toBe('Halwasan 1 kg');
  });
  it('spots test entries', () => {
    expect(looksLikeTest('"data"')).toBe(true);
    expect(looksLikeTest('Test 2')).toBe(true);
    expect(looksLikeTest('Krinal')).toBe(false);
    expect(looksLikeTest('Testa Bhai')).toBe(false);
  });
  it('lists open bookings soonest first', () => {
    const list = [pre('b', '2026-11-09', []), pre('a', undefined, []), pre('test', '2026-11-04', []), pre('c', '2026-11-04', []), pre('d', '2026-11-04', [], { status: 'delivered' })];
    expect(dueList(list).map(p => p.id)).toEqual(['c', 'test', 'b', 'a']);
  });
});

describe('today tiles', () => {
  const orders = [
    bill('Nikuj Rana', '2026-10-30T06:00:00Z', 7350, { is_paid: false, bill_no: 5 }),
    bill('Asha', '2026-10-31T06:00:00Z', 500),
    bill('Void', '2026-10-31T07:00:00Z', 900, { cancelled_at: '2026-10-31T07:10:00Z' }),
  ];
  it('names the oldest unpaid bill', () => {
    expect(unpaidOf(orders, [])).toEqual({ total: 7350, count: 1, first: { name: 'Nikuj Rana', billNo: 5 } });
  });
  it('totals open pre-bookings', () => {
    const list = [pre('a', '2026-11-04', [], { advance_paid: 200 }), pre('b', '2026-11-04', [], { status: 'cancelled', advance_paid: 50 })];
    expect(bookedOf(list)).toEqual({ total: 1000, count: 1, advance: 200 });
  });
  it('sums the season so far', () => {
    const diwali = { id: 'd', name: 'Diwali', is_active: true, start_date: '2026-10-25', end_date: '2026-11-08' };
    const list = [pre('Krinal', '2026-11-04', [line('Khajur Pak', 250, 56)], { advance_paid: 100 })];
    const s = seasonSoFar(diwali, orders, list);
    expect(s.bills).toEqual({ count: 2, total: 7850 });
    expect(s.bookings).toEqual({ count: 1, total: 1000 });
    expect(s.collected).toBe(600);
    expect(s.top[0]).toMatchObject({ name: 'Khajur Pak', amount: 14000 });
  });
});
