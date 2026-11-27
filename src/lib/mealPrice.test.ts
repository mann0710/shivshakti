import { discountSaving, isOnePrice, mealGap, oneEveryMeal, plateOff, priceMeal, rangedMeals, setMealOnePrice, showsDiscount, showsDishPrices } from './mealPrice';
import { mealSchedule } from './docs/menu';
import { acceptPatch, pickKey } from './quoteChoices';

const g = { id: 'g', label: 'Gujarati', pick: 1 };
const dish = (id: string, amount: number, choice?: object) => ({ item_id: id, item_name: id, category_name: 'Breakfast', subcategory_name: '', amount, choice }) as any;
const items = [dish('Tea', 15), dish('Poha', 25), dish('Khaman', 25, g), dish('Fafda', 45, g), dish('Handvo', 65, g)];
const blank = { id: 'b', meal_type: 'breakfast', time: '', guest_count: 300, per_plate_amount: 0, discount_amount: 0, items: [], subtotal: 0 };
const breakfast = priceMeal(blank, items, 65);
const dinner = priceMeal({ ...blank, id: 'd', meal_type: 'dinner' }, [dish('Paneer', 70), dish('Naan', 30)], 100);
const days = [{ day_number: 1, date: '2027-01-29', meals: [dinner], day_subtotal: dinner.subtotal },
  { day_number: 2, date: '2027-01-30', meals: [breakfast], day_subtotal: breakfast.subtotal }];

describe('meal prices', () => {
  it('a choose-any meal is a range until it gets one price', () => {
    expect([breakfast.per_plate_amount, breakfast.per_plate_max]).toEqual([65, 105]);
    expect(mealGap(breakfast)).toEqual({ min: 65, max: 105 });
    const one = setMealOnePrice(breakfast, true);
    expect([one.per_plate_amount, one.per_plate_max, one.subtotal, isOnePrice(one)]).toEqual([105, null, 31500, true]);
    expect(mealGap(one)).not.toBeNull();
    const back = setMealOnePrice(one, false);
    expect([back.per_plate_amount, back.per_plate_max]).toEqual([65, 105]);
  });
  it('turning one price off keeps your own plate price as the top', () => {
    const own = priceMeal(blank, items, 80);
    expect([own.per_plate_amount, own.per_plate_max]).toEqual([80, 120]);
    const back = setMealOnePrice(setMealOnePrice(own, true), false);
    expect([back.per_plate_amount, back.per_plate_max]).toEqual([80, 120]);
  });
  it('lists ranged meals by day and fixes them all at once', () => {
    expect(rangedMeals(days).map(x => [x.day, x.meal.meal_type])).toEqual([[2, 'breakfast']]);
    const fixed = oneEveryMeal(days);
    expect(rangedMeals(fixed)).toEqual([]);
    expect(fixed[1].day_subtotal).toBe(31500);
    expect(fixed[0].day_subtotal).toBe(dinner.subtotal);
  });
  it('dish prices print per meal unless turned off', () => {
    const off = { ...breakfast, hide_prices: true };
    expect([showsDishPrices(breakfast), showsDishPrices(off)]).toEqual([true, false]);
    const html = mealSchedule([{ ...days[0], meals: [dinner, { ...off, id: 'x', items: [dish('Upma', 33)] }] }], { amounts: true, itemPrices: true });
    expect(html).toContain('₹70');
    expect(html).not.toContain('₹33');
  });
  it('a plate discount is the full price over what they pay, shown unless turned off', () => {
    const d = { ...dinner, full_price: 120, guest_count: 400 };
    expect([plateOff(d), showsDiscount(d), discountSaving(d)]).toEqual([20, true, 8000]);
    expect([showsDiscount({ ...d, hide_discount: true }), discountSaving({ ...d, hide_discount: true })]).toEqual([false, 0]);
    expect(plateOff({ ...d, full_price: 90 })).toBe(0);
    const html = mealSchedule([{ ...days[0], meals: [d] }], { amounts: true, itemPrices: false });
    expect(html).toContain('<s>₹120</s> ₹100 / plate');
    expect(html).toContain('₹20 off a plate saves ₹8,000');
    const hidden = mealSchedule([{ ...days[0], meals: [{ ...d, hide_discount: true }] }], { amounts: true, itemPrices: false });
    expect(hidden).not.toContain('₹120');
    expect(mealSchedule([{ ...days[1], meals: [{ ...breakfast, full_price: 80 }] }], { amounts: true, itemPrices: false })).toContain('₹15 off a plate');
    expect(plateOff({ ...d, discount_amount: 95 })).toBe(0);
    const one = setMealOnePrice({ ...breakfast, full_price: 80 }, true);
    expect([one.per_plate_amount, plateOff(one), plateOff(setMealOnePrice(one, false))]).toEqual([105, 15, 15]);
    const q = { is_multi_day: true, event_days: [{ ...days[1], meals: [{ ...breakfast, full_price: 80 }] }], gst_rate: 0 } as any;
    const locked = acceptPatch(q, new Set([pickKey('Handvo', breakfast.id)])).event_days![0].meals[0];
    expect([locked.per_plate_amount, plateOff(locked)]).toEqual([105, 15]);
  });
});
