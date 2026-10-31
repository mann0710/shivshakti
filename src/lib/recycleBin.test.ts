import { BinEntry, binText, childNote, daysLeft, groupBin, parentRefs, restorePlan } from './recycleBin';

const T0 = '2026-10-20T10:00:00.000Z';
const later = (min: number) => new Date(Date.parse(T0) + min * 60000).toISOString();
let n = 0;
const e = (kind: string, data: Record<string, any>, at = T0): BinEntry => ({ id: `b${++n}`, kind, row_id: data.id, label: data.name ?? '', data, deleted_at: at });

describe('recycle bin', () => {
  const cat = e('menu_categories', { id: 'c1', name: 'Chaat Street' });
  const sub = e('menu_subcategories', { id: 's1', name: 'Delhi Ki Chaat', category_id: 'c1' }, later(0.1));
  const dish1 = e('menu_items', { id: 'd1', name: 'Raj Kachori', subcategory_id: 's1', default_price: 60 }, later(0.2));
  const dish2 = e('menu_items', { id: 'd2', name: 'Papdi Chaat', subcategory_id: 's1' }, later(0.2));
  const lone = e('menu_items', { id: 'd3', name: 'Dahi Puri', subcategory_id: 's9' }, later(90));
  const bin = [dish1, lone, cat, sub, dish2];

  it('nests what was deleted along with a category under it', () => {
    const groups = groupBin(bin);
    expect(groups.map(g => g.entry.data.name)).toEqual(['Dahi Puri', 'Chaat Street']);
    expect(groups[1].children.map(c => c.data.name)).toEqual(['Delhi Ki Chaat', 'Raj Kachori', 'Papdi Chaat']);
    expect(childNote(groups[1].children)).toBe('with 1 subcategory and 2 dishes');
  });

  it('restores a category with its subcategory and dishes, parents first', () => {
    const plan = restorePlan(cat, bin, () => false);
    expect(plan.problem).toBeUndefined();
    expect(plan.steps.map(s => s.values.name)).toEqual(['Chaat Street', 'Delhi Ki Chaat', 'Raj Kachori', 'Papdi Chaat']);
  });

  it('brings a deleted parent back from the bin first', () => {
    expect(parentRefs(dish1, bin)).toEqual([{ table: 'menu_subcategories', id: 's1' }, { table: 'menu_categories', id: 'c1' }]);
    const plan = restorePlan(dish1, bin, () => false);
    expect(plan.steps.map(s => s.table)).toEqual(['menu_categories', 'menu_subcategories', 'menu_items']);
  });

  it('refuses when a needed parent is gone for good, clears an optional one', () => {
    expect(restorePlan(lone, bin, () => false).problem).toMatch(/menu subcategory is gone for good/);
    expect(restorePlan(lone, bin, r => r.id === 's9').steps).toHaveLength(1);
    const quote = e('quotations', { id: 'q1', quotation_number: 'QTN-0023', customer_id: 'k1', booking_id: 'gone' });
    const plan = restorePlan(quote, [quote], r => r.table === 'customers');
    expect(plan.steps[0].values.booking_id).toBeNull();
  });

  it('describes rows and counts the days left', () => {
    const quote = e('quotations', { id: 'q2', quotation_number: 'QTN-0024', total_amount: 37800, issue_date: '2026-10-02' });
    expect(binText(quote).title).toBe('QTN-0024');
    expect(binText(quote).line).toMatch(/^Quotation · ₹37,800 · 2 Oct/);
    expect(binText(dish1).line).toBe('Dish · ₹60 a plate');
    expect(daysLeft(cat, Date.parse(later(60 * 24 * 3)))).toBe(27);
    expect(daysLeft({ ...cat, kind: 'import' }, Date.parse(later(60 * 24 * 8)))).toBe(0);
  });
});
