import { revisionChanges, sameAsRevision, snapshotOf } from './quoteRevisions';

const meal = (id: string, guests: number, pp: number) => ({ id, meal_type: 'dinner', time: '20:30', guest_count: guests, per_plate_amount: pp, discount_amount: 0, items: [], subtotal: guests * pp });
const q = (meals: any[], extra = 0) => ({ id: 'q', is_multi_day: true, total_amount: 1000, revisions: [], event_days: [{ day_number: 1, date: '2026-11-28', meals, day_subtotal: 0 }],
  extra_charges: extra ? [{ description: 'Water', amount: extra }] : [], transportation_charges: [], additional_discounts: [] }) as any;

describe('quote revisions', () => {
  it('keeps the fields to restore, numbered from one', () => {
    const s = snapshotOf(q([meal('a', 550, 1138)]), '2026-11-27T10:00:00Z');
    expect([s.n, s.total, (s.quote.event_days as any[])[0].meals[0].guest_count]).toEqual([1, 1000, 550]);
    expect(s.quote).not.toHaveProperty('id');
  });
  it('lists what changed meal by meal, then charges', () => {
    const before = q([meal('a', 550, 1138), meal('b', 200, 35)]);
    const after = q([meal('a', 600, 1138), meal('c', 100, 50)], 26000);
    expect(revisionChanges(before, after)).toEqual([
      'Sat 28 Nov Dinner · 8:30 PM · 550 → 600 guests', 'Sat 28 Nov Dinner · 8:30 PM · added', 'Dinner · 8:30 PM · removed', 'Extras and transport · ₹0 → ₹26,000',
    ]);
  });
  it('keeps the booking fields too, and knows when nothing changed', () => {
    const one = { ...q([meal('a', 100, 200)]), booking: { event_date: '2026-11-25', event_time: '11:00:00', venue: 'Hall', event_type: 'Vashtu', guest_count: 140 } };
    const v = snapshotOf(one, 'x');
    expect(v.booking).toMatchObject({ event_date: '2026-11-25', venue: 'Hall' });
    expect(sameAsRevision(v, one)).toBe(true);
    const moved = { ...one, booking: { ...one.booking, event_date: '2026-11-26', event_time: '12:30' } };
    expect(revisionChanges({ ...(v.quote as any), booking: v.booking }, moved)).toEqual(['Date · 25 Nov → 26 Nov', 'Time · 11:00 → 12:30']);
    expect(sameAsRevision(v, moved)).toBe(false);
  });
});
