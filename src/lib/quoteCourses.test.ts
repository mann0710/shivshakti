import { courseMap, dropDish, moveCourse, renameChoice, renameCourse, renameSection, setCourse } from './quoteCourses';
import { subGroups } from './menuOrder';
import { coursesOf } from './quoteSummary';

const d = (name: string, cat: string, extra: object = {}) =>
  ({ item_id: name, item_name: name, category_name: cat, subcategory_name: cat, amount: 0, ...extra }) as any;
const farsan = { id: 'g', label: 'Farsan', pick: 1 };
const items = () => [d('Ladoo', 'Sweet'), d('Puri', 'Main Course'), d('Mix Bhajiya', 'Farsan'), d('Dal', 'Main Course'), d('Salad', 'Including')];
const plan = (list: any[]) => Object.fromEntries(courseMap(list));

describe('owner moves and renames courses in a quote', () => {
  it('drops a dish before another in a different course and gives it that course', () => {
    const next = dropDish(items(), 'Mix Bhajiya', { course: 'Main Course', beforeId: 'Dal' });
    expect(plan(next)).toEqual({ Sweet: ['Ladoo'], 'Main Course': ['Puri', 'Mix Bhajiya', 'Dal'], Including: ['Salad'] });
    expect(next.find(i => i.item_id === 'Mix Bhajiya')!.course).toBe('Main Course');
  });
  it('drops at the end of a course, and reorders within a course without pinning it', () => {
    expect(plan(dropDish(items(), 'Dal', { course: 'Sweet' })).Sweet).toEqual(['Ladoo', 'Dal']);
    const same = dropDish(items(), 'Dal', { course: 'Main Course', beforeId: 'Puri' });
    expect(plan(same)['Main Course']).toEqual(['Dal', 'Puri']);
    expect(same.find(i => i.item_id === 'Dal')!.course).toBeUndefined();
  });
  it('moves a whole "choose any" group with its dish', () => {
    const list = [...items(), d('South Boll', 'Farsan', { choice: farsan }), d('Patra', 'Farsan', { choice: farsan })];
    const next = dropDish(list, 'Patra', { course: 'Main Course' });
    expect(next.filter(i => i.choice).map(i => i.course)).toEqual(['Main Course', 'Main Course']);
    expect(plan(next)['Main Course']).toEqual(['Puri', 'Dal', 'South Boll', 'Patra']);
  });
  it('puts a dish in a new course, which sits before the accompaniments', () => {
    expect(Object.keys(plan(setCourse(items(), 'Puri', 'Live Counter')))).toEqual(['Sweet', 'Main Course', 'Farsan', 'Live Counter', 'Including']);
  });
  it('moves a whole course up or down and keeps that order', () => {
    expect(Object.keys(plan(moveCourse(items(), 'Including', 'Sweet', false)))).toEqual(['Including', 'Sweet', 'Main Course', 'Farsan']);
    expect(Object.keys(plan(moveCourse(items(), 'Sweet', 'Farsan', true)))).toEqual(['Main Course', 'Farsan', 'Sweet', 'Including']);
  });
  it('renames a course in place, a choice title too; a blank name goes back to Menu Builder', () => {
    const named = renameCourse(items(), 'Including', 'Extras');
    expect(Object.keys(plan(named))).toEqual(['Sweet', 'Main Course', 'Farsan', 'Extras']);
    const list = [...items(), d('South Boll', 'Farsan', { choice: farsan })];
    const starters = renameCourse(list, 'Farsan', 'Starters');
    expect(starters.find(i => i.item_id === 'South Boll')!.choice!.label).toBe('Starters');
    expect(plan(starters).Starters).toEqual(['Mix Bhajiya', 'South Boll']);
    expect(renameCourse(named, 'Extras', ' ').find(i => i.item_id === 'Salad')!.course).toBeUndefined();
  });
});

describe('section headings and choices inside a course', () => {
  const main = () => [d('Puri', 'Main Course', { subcategory_name: 'Indian Breads' }), d('Shaak', 'Main Course', { subcategory_name: 'Gujarati Vegetables' }),
    d('Chana', 'Main Course', { subcategory_name: 'Kathod', choice: { id: 'k', label: 'Kathod', pick: 1 } }),
    d('Vaal', 'Main Course', { subcategory_name: 'Kathod', choice: { id: 'k', label: 'Kathod', pick: 1 } })];
  const heads = (list: any[]) => subGroups(coursesOf(list).find(c => c.name === 'Main Course')!).map(g => g.name || g.entries[0].choice?.meta.label);
  it('a choice moved into Main Course stays one named block there', () => {
    const moved = setCourse(main(), 'Chana', 'Main Course');
    expect(coursesOf(moved).map(c => c.name)).toEqual(['Main Course']);
    expect(heads(moved)).toEqual(['Indian Breads', 'Gujarati Vegetables', 'Kathod']);
  });
  it('renames a heading for this quote only, and blank goes back', () => {
    const moved = setCourse(main(), 'Chana', 'Main Course');
    const named = renameSection(moved, 'Main Course', 'Indian Breads', 'Rotli');
    expect(heads(named)).toEqual(['Rotli', 'Gujarati Vegetables', 'Kathod']);
    expect(named[0].subcategory_name).toBe('Indian Breads');
    expect(renameSection(named, 'Main Course', 'Rotli', '  ')[0].sub_label).toBeUndefined();
  });
  it('renames a choice inside a course without moving it out', () => {
    const named = renameChoice(setCourse(main(), 'Chana', 'Main Course'), 'Main Course', 'k', 'Kathod (pick one)');
    expect(coursesOf(named).map(c => c.name)).toEqual(['Main Course']);
    expect(heads(named)).toEqual(['Indian Breads', 'Gujarati Vegetables', 'Kathod (pick one)']);
  });
});
