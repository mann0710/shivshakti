import { isOnePrice, mealGap, oneEveryMeal, priceMeal, rangedMeals, setMealOnePrice, showsDishPrices } from './mealPrice';
import { mealSchedule } from './docs/menu';

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
});
