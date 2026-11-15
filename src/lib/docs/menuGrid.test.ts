import { courseGrid } from './menuGrid';
import { mealSchedule } from './menu';

const d = (name: string, course: string, amount = 0, extra: object = {}) =>
  ({ item_id: name, item_name: name, category_name: course, subcategory_name: course, amount, course, ...extra }) as any;

describe('menu layout (design B)', () => {
  it('runs of one-dish courses become one compact list with the course beside each dish', () => {
    const html = courseGrid([d('Juice', 'Cold Appetizers', 55), d('Soup', 'Soups', 60), d('Kheer', 'Sweet'), d('Gulab Jamun', 'Sweet')], true);
    expect(html.match(/course quick/g)).toHaveLength(1);
    expect(html).toContain('<div class="sg-l">Cold Appetizers</div>');
    expect(html).toContain('<div class="sg-l">Soups</div>');
    expect(html).toContain('<div class="course-h">Sweet<span class="num">2 dishes</span>');
  });
  it('labels share one width sized to the longest, capped', () => {
    expect(courseGrid([d('A', 'Gujarati Vegetables'), d('B', 'Dal')], false)).toContain('--lw:116px');
    expect(courseGrid([d('A', 'Dal'), d('B', 'Rice')], false)).toContain('--lw:56px');
  });
  it('a course longer than four dishes may continue in the next column', () => {
    const five = Array.from({ length: 5 }, (_, i) => d(`Sabji ${i}`, 'Main Course'));
    expect(courseGrid(five, false)).toContain('<table class="course long">');
    expect(courseGrid(five.slice(0, 4), false)).toContain('<table class="course">');
  });
  it('drops a course heading that repeats the meal and shows ranges on the day and meal', () => {
    const meal = { id: 'm', meal_type: 'breakfast', time: '', guest_count: 10, per_plate_amount: 65, per_plate_max: 105, discount_amount: 0, subtotal: 650,
      items: [d('Chai', 'Breakfast'), d('Coffee', 'Breakfast')] };
    const html = mealSchedule([{ day_number: 1, date: '2027-02-16', meals: [meal], day_subtotal: 650 }], { amounts: true, itemPrices: false });
    expect(html).not.toContain('<div class="course-h">Breakfast');
    expect(html).toContain('₹650 – ₹1,050');
    expect(html).toContain('final once you choose');
  });
  it('a same-price choice shows its plate cost once, not per dish', () => {
    const soup = { id: 's', pick: 1, label: 'Chinese Soup', included: true };
    const items = [d('Mocktail Bar', 'Cold Appetizers', 90), d('Thukpa Soup', 'Chinese Soup', 60, { choice: soup }), d('Aglio Soup', 'Chinese Soup', 0, { choice: soup })];
    const html = courseGrid(items, 'diff');
    expect(html).toContain('Choose 1 of 2 · <span class="num">₹60 / plate</span>');
    expect(html).not.toContain('+₹60');
    expect(courseGrid(items, false)).not.toContain('₹60');
  });
  it('prints dish prices when ticked even if the plate price is above the dishes', () => {
    const meal = { id: 'm', meal_type: 'dinner', time: '', guest_count: 100, per_plate_amount: 325, discount_amount: 0, subtotal: 32500,
      items: [d('Fulka Roti', 'Indian Breads', 55), d('Sev Tameta', 'Main Course', 35)] };
    const day = (m: object) => [{ day_number: 1, date: '2027-02-15', meals: [m], day_subtotal: 32500 }] as any;
    expect(mealSchedule(day(meal), { amounts: true, itemPrices: true })).toContain('₹55');
    expect(mealSchedule(day({ ...meal, hide_prices: true }), { amounts: true, itemPrices: true })).not.toContain('₹55');
  });
});
