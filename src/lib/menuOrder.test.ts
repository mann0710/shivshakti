import { planCourses, roleOf, isAccompaniment } from './menuOrder';
import { courseGrid } from './docs/menu';
import { choiceGroups } from './quoteChoices';

const d = (name: string, cat: string, sub: string, extra: object = {}) =>
  ({ item_id: name, item_name: name, category_name: cat, subcategory_name: sub, amount: 0, ...extra }) as any;
const names = (c: { entries: { item?: { item_name: string } }[] }) => c.entries.map(e => e.item?.item_name ?? 'choice');

// QTN-0023 (Kavit Mangrolya) in the order it was built.
const menu = [
  d('Churma Na Ladoo', 'Sweet', 'Gujarati Sweet'),
  d('Puri', 'Indian Breads', 'Indian Breads'),
  d('Ringan Bataka Nu Shaak', 'Main Course', 'Gujarati Vegetables'),
  d('Desi Vaal', 'Main Course', 'Kathod'),
  d('South Boll', 'Main Course', 'Farsan', { served_with: 'Coconut Chutney', served_ids: ['Coconut Chutney'] }),
  d('Coconut Chutney', 'Including', 'Including'),
  d('Green Salad', 'Including', 'Including'),
  d('Aachar', 'Including', 'Including'),
  d('Water Jug', 'Including', 'Including'),
  d('Taj-Laving Rice', 'Aromatic Rice', 'Aromatic Rice'),
  d('Gujarati Varani Dal', 'Delicious Dal', 'Delicious Dal'),
];

describe('menu order (design A)', () => {
  it('keeps the set order: farsan under Main Course in one flat Main Course, accompaniments last', () => {
    const plan = planCourses(menu, { merge: true });
    expect(plan.map(c => c.name)).toEqual(['Sweet', 'Main Course', 'Including']);
    expect(names(plan[1])).toEqual(['Puri', 'Ringan Bataka Nu Shaak', 'Desi Vaal', 'South Boll', 'Taj-Laving Rice', 'Gujarati Varani Dal']);
    expect(names(plan[2])).toEqual(['Green Salad', 'Aachar', 'Water Jug']);
  });
  it('a course the owner set wins, and placed accompaniments stay where they are', () => {
    const own = menu.map(i => (i.item_name === 'South Boll' ? { ...i, course: 'Farsan' } : i.item_name === 'Green Salad' ? { ...i, course: 'Salads' } : i));
    expect(planCourses(own, { merge: true }).map(c => c.name)).toEqual(['Sweet', 'Main Course', 'Farsan', 'Salads', 'Including']);
  });
  it('prints "with Coconut Chutney" under the farsan and not again in Including', () => {
    const html = courseGrid(menu, false);
    expect(html).toContain('<div class="with">with Coconut Chutney</div>');
    expect(html.match(/Coconut Chutney/g)).toHaveLength(1);
  });
  it('keeps every dish when counting prices (no merge)', () => {
    expect(planCourses(menu).pop()!.entries).toHaveLength(4);
  });
  it('a course that is only a choice becomes a choice card with tick boxes', () => {
    const g = { id: 'g', label: 'Farsan', pick: 1 };
    const withAlt = menu.map(i => (i.item_name === 'South Boll' ? { ...i, choice: g } : i));
    withAlt.splice(5, 0, d('Mix Bhajiya', 'Main Course', 'Farsan', { choice: g }));
    const html = courseGrid(withAlt, false);
    expect(html).toContain('<div class="course pick"><div class="course-h">Farsan · choose any 1');
    expect(html).toContain('Tick one.');
    expect(planCourses(withAlt, { groups: choiceGroups(withAlt) })[2].count).toBe(1);
  });
  it('a long course spans both columns', () => {
    const many = Array.from({ length: 9 }, (_, i) => d(`Sabji ${i}`, 'Main Course', 'Vegetables'));
    expect(courseGrid(many, false)).toContain('class="course wide"');
  });
  it('recognises roles and accompaniments', () => {
    expect(roleOf(d('x', 'Delicious Dal', ''))).toBe('main');
    expect(roleOf(d('x', 'Starters', 'Veg Starters'))).toBe('own');
    expect(roleOf(d('x', 'Including', ''))).toBe('accomp');
    expect(isAccompaniment('Including', 'Including', 'Coconut Chutney')).toBe(true);
    expect(isAccompaniment('Main Course', 'Farsan', 'South Boll')).toBe(false);
  });
});
