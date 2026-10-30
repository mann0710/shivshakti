import { planCourses, roleOf } from './menuOrder';
import { courseGrid } from './docs/menu';

const d = (name: string, cat: string, sub: string, extra: object = {}) =>
  ({ item_id: name, item_name: name, category_name: cat, subcategory_name: sub, amount: 0, ...extra }) as any;

// QTN-0023 (Kavit Mangrolya) in the order it was built.
const menu = [
  d('Churma Na Ladoo', 'Sweet', 'Gujarati Sweet'),
  d('Puri', 'Indian Breads', 'Indian Breads'),
  d('Ringan Bataka Nu Shaak', 'Main Course', 'Gujarati Vegetables'),
  d('Desi Vaal', 'Main Course', 'Kathod'),
  d('South Boll', 'Main Course', 'Farsan'),
  d('Coconut Chutney', 'Including', 'Including'),
  d('Green Salad', 'Including', 'Including'),
  d('Aachar', 'Including', 'Including'),
  d('Water Jug', 'Including', 'Including'),
  d('Taj-Laving Rice', 'Aromatic Rice', 'Aromatic Rice'),
  d('Gujarati Varani Dal', 'Delicious Dal', 'Delicious Dal'),
];

describe('menu order', () => {
  it('keeps the set order, puts dal/rice/breads in Main Course and accompaniments last', () => {
    const plan = planCourses(menu, { pair: true });
    expect(plan.map(c => c.name)).toEqual(['Sweet', 'Main Course', 'Including']);
    expect(plan[1].subs.map(s => s.name)).toEqual(['Indian Breads', 'Gujarati Vegetables', 'Kathod', 'Farsan', 'Aromatic Rice', 'Delicious Dal']);
    expect(plan[2].subs[0].items.map(i => i.item_name)).toEqual(['Green Salad', 'Aachar', 'Water Jug']);
  });
  it('serves the chutney with the farsan', () => {
    const farsan = planCourses(menu, { pair: true })[1].subs.find(s => s.name === 'Farsan')!;
    expect(farsan.items[0].served_with).toBe('Coconut Chutney');
    expect(courseGrid(menu, false)).toContain('Served with Coconut Chutney');
  });
  it('a "Served with" typed by the owner wins and the chutney is not repeated', () => {
    const own = menu.map(i => (i.item_name === 'Desi Vaal' ? { ...i, served_with: 'Coconut Chutney' } : i));
    const plan = planCourses(own, { pair: true });
    expect(plan[1].subs.find(s => s.name === 'Farsan')!.items[0].served_with).toBeUndefined();
    expect(plan[2].subs[0].items.map(i => i.item_name)).not.toContain('Coconut Chutney');
  });
  it('a chutney with no snack on the menu stays with the accompaniments', () => {
    const noSnack = menu.filter(i => i.item_name !== 'South Boll');
    expect(planCourses(noSnack, { pair: true }).pop()!.subs[0].items[0].item_name).toBe('Coconut Chutney');
  });
  it('an alternative prints inside its own course', () => {
    const g = { id: 'g', label: 'Gujarati Sweet', pick: 1 };
    const withAlt = [{ ...menu[0], choice: g }, d('Mohanthal', 'Sweet', 'Gujarati Sweet', { choice: g }), ...menu.slice(1)];
    const html = courseGrid(withAlt, false);
    expect(html.indexOf('Gujarati Sweet · choose any 1')).toBeGreaterThan(html.indexOf('>Sweet<'));
    expect(html.indexOf('Gujarati Sweet · choose any 1')).toBeLessThan(html.indexOf('>Main Course<'));
  });
  it('recognises roles from category names', () => {
    expect(roleOf(d('x', 'Delicious Dal', ''))).toBe('main');
    expect(roleOf(d('x', 'Starters', 'Veg Starters'))).toBe('own');
    expect(roleOf(d('x', 'Including', ''))).toBe('accomp');
  });
});
