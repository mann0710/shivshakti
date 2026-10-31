import { planDishes, planPaste, pasteWrites, pasteSummary, dishSheet, dishTemplate, MenuData } from './importDishes';
import type { Dish } from './menuCatalog';
import type { XCell } from './xlsx';

const at = '2026-01-01T00:00:00Z';
const cats = [{ id: 'c1', name: 'Chaat Street', is_active: true, created_at: at }, { id: 'c2', name: 'Chinese Cuisine', is_active: true, created_at: at }];
const subs = [
  { id: 's1', category_id: 'c1', name: 'Delhi Ki Chaat', is_active: true, created_at: at },
  { id: 's2', category_id: 'c1', name: 'Indori Chaat', is_active: true, created_at: at },
  { id: 's3', category_id: 'c2', name: 'Starters', is_active: true, created_at: at },
];
const dish = (id: string, name: string, subcategory_id: string, default_price: number | null = null, food_styles: string[] = []): Dish =>
  ({ id, name, subcategory_id, default_price, food_styles, is_active: true, created_at: at });
const data: MenuData = {
  cats, subs,
  dishes: [
    dish('d1', 'Aloo Tikki With Chutney', 's1'), dish('d2', 'Dahi Balla', 's1', 50), dish('d3', 'Biscuit Chaat', 's1', 40),
    dish('d4', 'Kaju Kasata', 's1', 90), dish('d5', 'Samosa', 's1', 20), dish('d6', 'Samosa', 's3', 25),
  ],
};
const HEAD = ['Category', 'Subcategory', 'Dish', 'Price per plate', 'Food style', 'On quotes'];
const ids = () => { let n = 0; return () => `new${++n}`; };
const plan = (rows: XCell[][], answers = {}) => planDishes([{ name: 'Menu', rows: [HEAD, ...rows] }], data, answers, ids());

describe('dish import', () => {
  it('sorts rows into new, price added / changed, moved and same', () => {
    const p = plan([
      ['Chaat Street', 'Delhi Ki Chaat', 'Aloo Tikki With Chutney', 45, '', 'Yes'],
      ['Chaat Street', 'Delhi Ki Chaat', 'Dahi Balla', 55, '', ''],
      ['Chaat Street', 'Delhi Ki Chaat', 'Raj Kachori', 60, 'Jain', ''],
      ['Chaat Street', 'Indori Chaat', 'Biscuit Chaat', 40, '', ''],
      ['Chaat Street', 'Delhi Ki Chaat', 'Samosa', 20, '', ''],
      ['Chinese Cuisine', 'Starters', 'Samosa', 25, '', 'No'],
    ]);
    expect(p.changes.map(c => [c.row, c.chip, c.name])).toEqual([
      [2, 'Price added', 'Aloo Tikki With Chutney'], [3, 'Price changed', 'Dahi Balla'], [4, 'New dish', 'Raj Kachori'],
      [5, 'Moved', 'Biscuit Chaat'], [6, 'Same', 'Samosa'], [7, 'Updated', 'Samosa'],
    ]);
    expect(p.changes[3].where).toBe('Delhi Ki Chaat → Indori Chaat');
    expect(p.changes[0].details).toEqual([{ label: 'Price', old: 'no price', next: '₹45' }]);
    expect(p.writes[0]).toEqual({ table: 'menu_items', id: 'new1', values: { id: 'new1', name: 'Raj Kachori', subcategory_id: 's1', default_price: 60, food_styles: ['jain'], is_active: true } });
    expect(p.writes.find(w => w.id === 'd2')).toEqual({ table: 'menu_items', id: 'd2', values: { default_price: 55 }, old: { default_price: 50 } });
    expect(p.writes.find(w => w.id === 'd6')).toEqual({ table: 'menu_items', id: 'd6', values: { is_active: false }, old: { is_active: true } });
    expect(p.decisions).toEqual([]);
  });

  it('asks once for a messy price written the same way, then uses or skips it', () => {
    const rows = [['Chaat Street', 'Delhi Ki Chaat', 'Raj Kachori', '₹ 60/-'], ['Chaat Street', 'Delhi Ki Chaat', 'Papdi Chaat', '₹ 45/-']];
    const open = plan(rows);
    expect(open.decisions).toEqual([{ id: 'price:₹ #/-', row: 2, text: 'Price "₹ 60/-" is not a number. Use 60? Same fix for 1 more row written like this.', yes: 'Use 60 · fix all 2', no: 'Skip these 2 rows' }]);
    expect(open.open).toBe(1);
    expect(open.changes.every(c => c.tile === 'decide')).toBe(true);
    expect(open.writes).toEqual([]);
    const yes = plan(rows, { 'price:₹ #/-': true });
    expect(yes.writes.map(w => w.values.default_price)).toEqual([60, 45]);
    expect(plan(rows, { 'price:₹ #/-': false }).skipped.length).toBe(2);
  });

  it('suggests the closest subcategory or creates it', () => {
    const rows = [['Chaat Street', 'Delhi Chaat', 'Raj Kachori', 60]];
    const p = plan(rows);
    expect(p.decisions[0]).toMatchObject({ text: 'Subcategory "Delhi Chaat" is not in Menu Builder. Did you mean "Delhi Ki Chaat"?', yes: 'Use Delhi Ki Chaat', no: 'Create "Delhi Chaat"' });
    const id = p.decisions[0].id;
    expect(plan(rows, { [id]: true }).writes[0].values.subcategory_id).toBe('s1');
    const made = plan(rows, { [id]: false });
    expect(made.writes.map(w => [w.table, w.values.name])).toEqual([['menu_subcategories', 'Delhi Chaat'], ['menu_items', 'Raj Kachori']]);
    expect(made.writes[1].values.subcategory_id).toBe(made.writes[0].id);
  });

  it('creates a new category and subcategory once when agreed', () => {
    const rows = [['Fusion Delights', 'Tacos', 'Paneer Taco', 120], ['Fusion Delights', 'Tacos', 'Corn Taco', 100]];
    const p = plan(rows);
    expect(p.decisions).toHaveLength(1);
    const made = plan(rows, { [p.decisions[0].id]: true });
    expect(made.writes.map(w => w.table)).toEqual(['menu_categories', 'menu_subcategories', 'menu_items', 'menu_items']);
    expect(made.changes[0].where).toBe('Fusion Delights › Tacos (new)');
  });

  it('asks about a near-duplicate dish name', () => {
    const rows = [['Chaat Street', 'Delhi Ki Chaat', 'Kaju Cassata', 95]];
    const p = plan(rows);
    expect(p.decisions[0]).toMatchObject({ id: 'same:2', text: '"Kaju Cassata" looks like "Kaju Kasata", which is already saved.', yes: 'Same dish — update it', no: 'Add as new dish' });
    expect(plan(rows, { 'same:2': true }).writes).toEqual([{ table: 'menu_items', id: 'd4', values: { default_price: 95 }, old: { default_price: 90 } }]);
    expect(plan(rows, { 'same:2': false }).changes[0].chip).toBe('New dish');
  });

  it('updates by name anywhere when no subcategory is given, and never clears a price', () => {
    const p = planDishes([{ name: 'S', rows: [['Item', 'Rate'], ['Dahi Balla', ''], ['Biscuit Chaat', 45], ['Unknown Dish', 10]] }], data, {}, ids());
    expect(p.changes.map(c => c.chip)).toEqual(['Same', 'Price changed']);
    expect(p.skipped).toEqual([{ row: 4, name: 'Unknown Dish', why: 'Not in Menu Builder and no subcategory given' }]);
  });

  it('leaves out rows listed twice and reports a missing Dish column', () => {
    const p = plan([['Chaat Street', 'Delhi Ki Chaat', 'Raj Kachori', 60], ['Chaat Street', 'Delhi Ki Chaat', 'raj kachori', 65]]);
    expect(p.skipped[0].why).toBe('Listed twice; row 2 is used');
    expect(planDishes([{ name: 'S', rows: [['Category', 'Price'], ['x', 1]] }], data, {}, ids()).missing).toEqual(['Dish']);
  });

  it('never sends food styles before the food_styles column exists', () => {
    const rows = [HEAD, ['Chaat Street', 'Delhi Ki Chaat', 'Raj Kachori', 60, 'Jain', ''], ['Chaat Street', 'Delhi Ki Chaat', 'Dahi Balla', 50, 'Jain', '']];
    const p = planDishes([{ name: 'Menu', rows }], { ...data, withStyles: false }, {}, ids());
    expect(p.writes).toEqual([{ table: 'menu_items', id: 'new1', values: { id: 'new1', name: 'Raj Kachori', subcategory_id: 's1', default_price: 60, is_active: true } }]);
    expect(p.writes.some(w => 'food_styles' in w.values)).toBe(false);
  });

  it('accepts a name repeated as often as it is saved in that subcategory', () => {
    const twin = { ...data, dishes: [...data.dishes, dish('d7', 'Samosa', 's1', 22)] };
    const row = ['Chaat Street', 'Delhi Ki Chaat', 'Samosa', 22];
    const p = planDishes([{ name: 'Menu', rows: [HEAD, row, row, row] }], twin, {}, ids());
    expect(p.changes.map(c => c.chip)).toEqual(['Price changed', 'Same']);
    expect(p.skipped.map(s => s.why)).toEqual(['Listed twice; row 2 is used']);
  });

  it('downloads today\'s menu in the same columns, which imports back unchanged', () => {
    const sheet = dishSheet(data);
    expect(sheet[0]).toEqual(HEAD);
    expect(sheet[1]).toEqual(['Chaat Street', 'Delhi Ki Chaat', 'Aloo Tikki With Chutney', null, '', 'Yes']);
    const back = planDishes([{ name: 'Menu', rows: sheet }], data, {}, ids());
    expect(back.writes).toEqual([]);
    expect(back.changes.every(c => c.tile === 'same')).toBe(true);
    expect(dishTemplate()).toHaveLength(2);
  });
});

describe('paste a list', () => {
  const text = 'Raj Kachori 60\nPapdi Chaat 45\nAloo Tikki With Chutney 45\nDahi Balla 50\nRaj Kachori 65\nMoong Dal Chilla';
  it('marks each line new, price update, same or listed twice', () => {
    const rows = planPaste(text, 's1', data.dishes);
    expect(rows.map(r => [r.kind, r.name, r.price, r.old])).toEqual([
      ['new', 'Raj Kachori', 60, null], ['new', 'Papdi Chaat', 45, null], ['price', 'Aloo Tikki With Chutney', 45, null],
      ['same', 'Dahi Balla', 50, 50], ['twice', 'Raj Kachori', 65, null], ['new', 'Moong Dal Chilla', null, null],
    ]);
    expect(pasteSummary(rows)).toBe('3 new · 1 price update');
    const writes = pasteWrites(rows, 's1', ids());
    expect(writes.map(w => [w.id, w.values.name ?? w.values.default_price, w.old])).toEqual([
      ['new1', 'Raj Kachori', undefined], ['new2', 'Papdi Chaat', undefined], ['new3', 'Moong Dal Chilla', undefined], ['d1', 45, { default_price: null }],
    ]);
  });

  it('only matches dishes in the picked subcategory, and keeps names like "Paneer 65"', () => {
    const list = [...data.dishes, dish('d9', 'Paneer 65', 's3')];
    expect(planPaste('Samosa 22\nPaneer 65', 's3', list).map(r => [r.kind, r.name, r.price])).toEqual([['price', 'Samosa', 22], ['same', 'Paneer 65', null]]);
  });
});
