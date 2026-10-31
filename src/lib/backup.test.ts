import { ageText, backupJson, backupStale, everythingSheets, rowsToSheet } from './backup';
import { gstInside } from './gst';

describe('backup and export', () => {
  it('turns rows into a sheet with JSON for lists', () => {
    expect(rowsToSheet('Dishes', [{ id: 'a', name: 'Raj Kachori', food_styles: ['jain'] }, { id: 'b', price: 40 }]).rows).toEqual([
      ['id', 'name', 'food_styles', 'price'], ['a', 'Raj Kachori', '["jain"]', null], ['b', null, null, 40],
    ]);
  });

  it('puts readable names next to ids and keeps the usual sheet order', () => {
    const sheets = everythingSheets({
      menu_items: [{ id: 'd1', name: 'Raj Kachori', subcategory_id: 's1' }],
      menu_subcategories: [{ id: 's1', name: 'Delhi Ki Chaat', category_id: 'c1' }],
      menu_categories: [{ id: 'c1', name: 'Chaat Street' }],
      customers: [{ id: 'k1', name: 'Kavit' }],
      bookings: [{ id: 'b1', customer_id: 'k1', event_type: 'Vashtu' }],
    });
    expect(sheets.map(s => s.name)).toEqual(['Customers', 'Bookings', 'Menu categories', 'Menu subcategories', 'Dishes']);
    expect(sheets[1].rows[0].slice(0, 2)).toEqual(['customer', 'id']);
    expect(sheets[1].rows[1][0]).toBe('Kavit');
    expect(sheets[4].rows[1].slice(0, 3)).toEqual(['Chaat Street', 'Delhi Ki Chaat', 'd1']);
  });

  it('writes the backup in the usual shape and tells its age', () => {
    expect(JSON.parse(backupJson({ customers: [] }, '2026-10-31T10:00:00Z', 'proj'))).toEqual({ project: 'proj', taken_at: '2026-10-31T10:00:00Z', tables: { customers: [] } });
    const now = Date.parse('2026-10-31T10:00:00Z');
    expect(ageText('2026-10-31T08:00:00Z', now)).toBe('Today');
    expect(ageText('2026-10-26T08:00:00Z', now)).toBe('5 days ago');
    expect(backupStale('', now)).toBe(true);
    expect(backupStale('2026-10-20T08:00:00Z', now)).toBe(true);
    expect(backupStale('2026-10-29T08:00:00Z', now)).toBe(false);
  });

  it('splits GST already inside a sweets price', () => {
    expect(gstInside(1050, 5)).toEqual({ taxable: 1000, gst: 50 });
    expect(gstInside(500, 0)).toEqual({ taxable: 500, gst: 0 });
  });
});
