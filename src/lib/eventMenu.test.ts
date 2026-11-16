import { eventMenu } from './eventMenu';
import { courseGrid } from './docs/menuGrid';

const d = (name: string, cat: string, extra: object = {}) =>
  ({ item_id: name, item_name: name, category_name: cat, subcategory_name: cat, amount: 10, ...extra }) as any;
const sweet = { id: 's', pick: 1, label: 'Gujarati Sweet' };

describe('event page menu', () => {
  it('lists courses and the customer pick, and flags an open choice', () => {
    const decided = { items: [d('Churma Na Ladoo', 'Sweet', { choice: sweet, chosen: true }), d('Lapsi', 'Sweet', { choice: sweet }), d('Puri', 'Indian Breads')] } as any;
    const [b] = eventMenu(decided);
    expect(b.picks).toEqual([{ label: 'Gujarati Sweet', chosen: ['Churma Na Ladoo'], options: ['Churma Na Ladoo', 'Lapsi'] }]);
    expect(b.courses.find(c => c.name === 'Gujarati Sweet')).toMatchObject({ dishes: ['Churma Na Ladoo'], open: false });
    const open = { items: [d('Churma Na Ladoo', 'Sweet', { choice: sweet }), d('Lapsi', 'Sweet', { choice: sweet })] } as any;
    expect(eventMenu(open)[0].courses[0]).toMatchObject({ dishes: ['Churma Na Ladoo or Lapsi (to pick)'], open: true });
  });
  it('gives each meal of a multi-day quote its own block', () => {
    const q = { is_multi_day: true, event_days: [{ day_number: 1, date: '2027-02-15', meals: [{ id: 'm', meal_type: 'dinner', time: '20:00', items: [d('Puri', 'Indian Breads')] }] }] } as any;
    expect(eventMenu(q).map(b => b.title)).toEqual(['Day 1 · Dinner · 8:00 PM']);
    expect(eventMenu(undefined)).toEqual([]);
  });
  it('does not repeat "with Chutney" when the dish name already says it', () => {
    const bhajiya = d('Mix Bhajiya with Chutney', 'Main Course', { served_with: 'Chutney' });
    expect(eventMenu({ items: [bhajiya] } as any)[0].courses[0].dishes).toEqual(['Mix Bhajiya with Chutney']);
    expect(courseGrid([bhajiya], false)).not.toContain('class="with"');
    expect(courseGrid([d('Dhokla', 'Farsan', { served_with: 'Chutney' })], false)).toContain('with Chutney');
  });
});
