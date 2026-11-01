import { planCourses, roleOf, isAccompaniment, subGroups, showSubs } from './menuOrder';
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
  it('groups each course by subcategory so Farsan shows inside Main Course', () => {
    const main = planCourses(menu, { merge: true })[1];
    const groups = subGroups(main);
    expect(groups.map(g => `${g.name}: ${g.entries.map(e => e.item!.item_name).join(', ')}`)).toEqual([
      'Indian Breads: Puri', 'Gujarati Vegetables: Ringan Bataka Nu Shaak', 'Kathod: Desi Vaal', 'Farsan: South Boll', 'Aromatic Rice: Taj-Laving Rice', 'Delicious Dal: Gujarati Varani Dal']);
    expect(showSubs(groups)).toBe(true);
    expect(showSubs(subGroups(planCourses(menu, { merge: true })[2]))).toBe(false);
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
  it('prints subcategory headings inside a course that mixes them, none when it does not', () => {
    const html = courseGrid(menu, false);
    expect(html).toContain('<div class="sg-l">Farsan</div>');
    expect(html).toContain('<div class="sg-l">Indian Breads</div>');
    expect(courseGrid([d('A', 'Sweet', 'Gujarati Sweet'), d('B', 'Sweet', 'Gujarati Sweet')], false)).not.toContain('sg-l');
  });
  it('keeps every dish when counting prices (no merge)', () => {
    expect(planCourses(menu).pop()!.entries).toHaveLength(4);
  });
  it('a course that is only a choice becomes a choice card with tick boxes', () => {
    const g = { id: 'g', label: 'Farsan', pick: 1 };
    const withAlt = menu.map(i => (i.item_name === 'South Boll' ? { ...i, choice: g } : i));
    withAlt.splice(5, 0, d('Mix Bhajiya', 'Main Course', 'Farsan', { choice: g }));
    const html = courseGrid(withAlt, false);
    expect(html).toContain('<div class="course pick"><div class="course-h">Farsan · choose 1 of 2');
    expect(html).not.toContain('Tick one.');
    expect(planCourses(withAlt, { groups: choiceGroups(withAlt) })[2].count).toBe(1);
  });
  it('a long course may continue in the next column under a repeated heading', () => {
    const many = Array.from({ length: 15 }, (_, i) => d(`Sabji ${i}`, 'Main Course', 'Vegetables'));
    const html = courseGrid(many, false);
    expect(html).toContain('<table class="course long"><thead><tr><th><div class="course-h">Main Course');
    expect(courseGrid(many.slice(0, 3), false)).toContain('<table class="course"><thead>');
  });
  it('numbers two choices with the same title and says when a pick changes the price', () => {
    const a = { id: 'a', label: 'Punjabi Sabji', pick: 1 }, b = { id: 'b', label: 'Punjabi Sabji', pick: 1 };
    const list = [d('Paneer', 'Main Course', 'Punjabi Sabji', { choice: a, amount: 40 }), d('Kofta', 'Main Course', 'Punjabi Sabji', { choice: a, amount: 60 }),
      d('Mix Veg', 'Main Course', 'Punjabi Sabji', { choice: b }), d('Bhindi', 'Main Course', 'Punjabi Sabji', { choice: b })];
    const html = courseGrid(list, false);
    expect(html).toContain('Punjabi Sabji 1 · choose 1 of 2');
    expect(html).toContain('Punjabi Sabji 2 · choose 1 of 2');
    expect(html.match(/Your pick changes the plate price\./g)).toHaveLength(1);
  });
  it('recognises roles and accompaniments', () => {
    expect(roleOf(d('x', 'Delicious Dal', ''))).toBe('main');
    expect(roleOf(d('x', 'Starters', 'Veg Starters'))).toBe('own');
    expect(roleOf(d('x', 'Including', ''))).toBe('accomp');
    expect(isAccompaniment('Including', 'Including', 'Coconut Chutney')).toBe(true);
    expect(isAccompaniment('Main Course', 'Farsan', 'South Boll')).toBe(false);
  });
});
