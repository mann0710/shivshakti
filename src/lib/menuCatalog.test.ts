import { buildTree, filterDishes, withoutPrice, placesByName, placeFor, addDish, copyName, groupsOf, matchGroup, plateRow, withCount, plateSummary, Dish } from './menuCatalog';
import type { MenuCategory, MenuSubcategory } from '../hooks/useMenuBuilder';

const at = '2026-01-01T00:00:00Z';
const cat = (id: string, name: string, is_active = true): MenuCategory => ({ id, name, is_active, created_at: at });
const sub = (id: string, category_id: string, name: string, is_active = true): MenuSubcategory => ({ id, category_id, name, is_active, created_at: at });
const cats = [cat('c1', 'Chaat Street'), cat('c2', 'Sweet'), cat('c3', 'Old', false)];
const subs = [sub('s1', 'c1', 'Delhi Ki Chaat'), sub('s2', 'c1', 'Agra Ki Chaat'), sub('s3', 'c2', 'Halwa'), sub('s4', 'c1', 'Gone', false)];
const dish = (id: string, name: string, subId: string, is_active = true, default_price: number | null = null): Dish => {
  const s = subs.find(x => x.id === subId)!;
  return { id, name, subcategory_id: subId, is_active, default_price, created_at: at, subcategory: { ...s, category: cats.find(c => c.id === s.category_id) } };
};
const dishes = [
  dish('d1', 'Albeli Chaat', 's1'), dish('d2', 'Dahi Balla', 's1', true, 60), dish('d3', 'Aloo Tikki', 's2'),
  dish('d4', 'Moong Halwa', 's3', true, 90), dish('d5', 'Old Chaat', 's1', false),
];

describe('menu catalog', () => {
  it('builds the tree largest first with visible counts', () => {
    const tree = buildTree(cats, subs, dishes);
    expect(tree.map(t => [t.cat.name, t.count])).toEqual([['Chaat Street', 3], ['Sweet', 1]]);
    expect(tree[0].subs.map(s => [s.sub.name, s.count])).toEqual([['Delhi Ki Chaat', 2], ['Agra Ki Chaat', 1]]);
    expect(buildTree(cats, subs, dishes, true)[0].count).toBe(4);
  });

  it('filters by subcategory, category, search and missing price', () => {
    expect(filterDishes(dishes, { subId: 's1' }).map(d => d.id)).toEqual(['d1', 'd2']);
    expect(filterDishes(dishes, { catId: 'c1' }).map(d => d.id)).toEqual(['d1', 'd3', 'd2']);
    expect(filterDishes(dishes, { query: 'halwa', subId: 's1' }).map(d => d.id)).toEqual(['d4']);
    expect(filterDishes(dishes, { query: 'agra' }).map(d => d.id)).toEqual(['d3']);
    expect(filterDishes(dishes, { noPrice: true }).map(d => d.id)).toEqual(['d1', 'd3']);
    expect(filterDishes(dishes, { subId: 's1', showHidden: true })).toHaveLength(3);
    expect(filterDishes(dishes, {})).toEqual([]);
    expect(withoutPrice(dishes)).toBe(2);
  });

  it('finds where a package dish lives', () => {
    const places = placesByName(dishes);
    expect(placeFor(places, ' dahi balla ')).toBe('Chaat Street › Delhi Ki Chaat');
    expect(placeFor(places, 'Old Chaat')).toBeUndefined();
  });

  it('adds a dish once and names copies', () => {
    expect(addDish(['Dal'], ' dal ')).toEqual(['Dal']);
    expect(addDish(['Dal'], 'Rice')).toEqual(['Dal', 'Rice']);
    expect(addDish(['Dal'], '  ')).toEqual(['Dal']);
    expect(copyName('Besic', ['Besic'])).toBe('Besic (copy)');
    expect(copyName('Besic (copy)', ['Besic', 'Besic (copy)'])).toBe('Besic (copy 2)');
  });

  it('reads package lines as courses or Menu Builder dishes', () => {
    const tree = buildTree(cats, subs, dishes);
    const groups = groupsOf(tree);
    const places = placesByName(dishes);
    const sabji = plateRow('Sabji 2(Gujarati)', places, groups);
    expect(sabji).toMatchObject({ name: 'Sabji', count: 2, extra: '(Gujarati)', place: null, group: null });
    expect(withCount(sabji, 3)).toBe('Sabji 3(Gujarati)');
    expect(plateRow('Halwa', places, groups)).toMatchObject({ count: 1, group: 'Sweet › Halwa · 1 dish' });
    expect(plateRow('Dahi Balla', places, groups)).toMatchObject({ count: null, place: 'Chaat Street › Delhi Ki Chaat' });
    expect(matchGroup('Chaats', groups)?.name).toBe('Chaat Street');
    const rows = ['Sabji 2(Gujarati)', 'Roti', 'Dahi Balla'].map(t => plateRow(t, places, groups));
    expect(plateSummary(rows)).toBe('2 courses · 4 dishes');
    expect(plateSummary([])).toBe('No dishes yet');
  });
});
