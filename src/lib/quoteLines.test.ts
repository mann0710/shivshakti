import { searchDishes, mergeLines, moveLine, lineOf } from './quoteLines';

const menu = [
  { id: 'dal', name: 'Gujarati Varani Dal', subcategory: { name: 'Dal', category: { name: 'Main Course' } } },
  { id: 'dalbati', name: 'Dal Bati', subcategory: { name: 'Rajasthani', category: { name: 'Main Course' } } },
  { id: 'puri', name: 'Puri', subcategory: { name: 'Indian Breads', category: { name: 'Indian Breads' } } },
];

describe('quote dish list', () => {
  it('finds dishes by name or course, names that start with the text first, skipping ones in the menu', () => {
    expect(searchDishes(menu, 'dal', new Set()).map(m => m.id)).toEqual(['dalbati', 'dal']);
    expect(searchDishes(menu, 'breads', new Set()).map(m => m.id)).toEqual(['puri']);
    expect(searchDishes(menu, 'dal', new Set(['dalbati'])).map(m => m.id)).toEqual(['dal']);
    expect(searchDishes(menu, '  ', new Set())).toEqual([]);
  });
  it('adds only new dishes, or replaces the menu', () => {
    const cur = [lineOf(menu[2], 0)];
    const add = [lineOf(menu[2], 10), lineOf(menu[0], 0)];
    expect(mergeLines(cur, add, false).map(i => [i.item_id, i.amount])).toEqual([['puri', 0], ['dal', 0]]);
    expect(mergeLines(cur, add, true).map(i => i.item_id)).toEqual(['puri', 'dal']);
    expect(lineOf(menu[0], 25)).toEqual({ item_id: 'dal', item_name: 'Gujarati Varani Dal', category_name: 'Main Course', subcategory_name: 'Dal', amount: 25 });
  });
  it('moves a dish', () => {
    expect(moveLine(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
  });
});
