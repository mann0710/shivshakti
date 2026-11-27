import { youSave, pdfSummary, priceLines } from './quoteSummary';
import { quoteNotConfirmed } from './moneyView';
import { priceMeal } from './mealPrice';

const dish = (id: string, amount: number) => ({ item_id: id, item_name: id, category_name: 'Main', subcategory_name: '', amount }) as any;
const base = { id: 'd', meal_type: 'dinner', time: '20:30', guest_count: 400, per_plate_amount: 0, discount_amount: 0, items: [dish('Paneer', 400), dish('Naan', 303)], subtotal: 0 };
const dinner = priceMeal(base, base.items, 690);
const hiTea = { ...priceMeal({ ...base, id: 'h', meal_type: 'hi-tea' }, [dish('Tea', 40)], 35), guest_count: 200, hide_prices: true };
const days = [{ day_number: 1, date: '2026-11-27', meals: [dinner], day_subtotal: 0 }, { day_number: 2, date: '2026-11-28', meals: [hiTea], day_subtotal: 0 }];
const q = { is_multi_day: true, event_days: days, additional_discounts: [{ id: 'x', description: 'Discount', amount: 1000 }], extra_charges: [], transportation_charges: [], gst_rate: 0 } as any;

describe('quote summary', () => {
  it('adds plate discounts the PDF shows and discounts on the total', () => {
    expect(youSave(q)).toBe(13 * 400 + 1000);
    expect(youSave(q, false)).toBe(1000);
  });
  it('labels meals with their day and lists PDF differences', () => {
    expect(priceLines(q)[0].k).toBe('Fri 27 Nov · Dinner · 8:30 PM · 400 × ₹690 (₹13 off)');
    expect(pdfSummary(days, true)).toEqual(['Dish prices off for: Hi-tea · 8:30 PM (Sat 28 Nov)', 'Plate discount shown on: Dinner · 8:30 PM (Fri 27 Nov) ₹13 off']);
  });
  it('a booking whose quotes are all open needs its quote confirmed', () => {
    const list = [{ booking_id: 'b', status: 'draft' }, { booking_id: 'c', status: 'accepted' }] as any[];
    expect([quoteNotConfirmed('b', list), quoteNotConfirmed('c', list), quoteNotConfirmed('z', list)]).toEqual([true, false, false]);
  });
});
