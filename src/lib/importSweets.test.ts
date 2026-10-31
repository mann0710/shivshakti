import { planSweets, parseUnit, sweetSheet, SweetData } from './importSweets';
import type { SeasonalItem } from './itemCatalog';
import type { XCell } from './xlsx';

const at = '2026-01-01T00:00:00Z';
const item = (id: string, name: string, rate: number, extra: Partial<SeasonalItem> = {}): SeasonalItem => ({
  id, name, rate, price: rate, weight: 1000, weight_unit: 'gm', unit: 'kg', is_active: true, occasion_id: null, created_at: at,
  pack_sizes: null, pack_prices: null, category: null, ...extra,
});
const data: SweetData = {
  items: [
    item('i1', 'Kaju Katli', 1200, { occasion_id: 'o1', pack_prices: { 250: 310 } }),
    item('i2', 'Mohanthal', 560),
    item('i3', 'Rasmalai', 400, { unit: 'pc', weight: 1, weight_unit: 'pc' }),
    item('i4', 'Gulab Jamun', 0),
  ],
  occasions: [{ id: 'o1', name: 'Diwali' }, { id: 'o2', name: 'Rakhi' }],
  legacy: false,
};
const ids = () => { let n = 0; return () => `new${++n}`; };
const plan = (rows: XCell[][], answers = {}, d = data) => planSweets([{ name: 'Sweets', rows: [['Sweet', 'Price', 'Unit', 'Occasion', 'On POS'], ...rows] }], d, answers, ids());

describe('sweets import', () => {
  it('reads units in many spellings', () => {
    expect(['kg', 'Kgs', 'Litre', 'ltr', 'per piece', 'Pcs', 'box'].map(parseUnit)).toEqual(['kg', 'kg', 'ltr', 'ltr', 'pc', 'pc', null]);
  });

  it('plans new sweets, price changes and other details', () => {
    const p = plan([
      ['Kaju Katli', 1300, 'kg', 'Diwali', 'Yes'],
      ['Mohanthal', 560, '', 'Rakhi', 'No'],
      ['Gulab Jamun', 320, '', '', ''],
      ['Basundi', 300, 'litre', 'All year', ''],
      ['Rasmalai', 400, 'piece', '', ''],
    ]);
    expect(p.changes.map(c => [c.chip, c.name, c.where])).toEqual([
      ['Price changed', 'Kaju Katli', 'Diwali'], ['Updated', 'Mohanthal', 'Rakhi'], ['Price added', 'Gulab Jamun', 'All year'],
      ['New sweet', 'Basundi', 'All year'], ['Same', 'Rasmalai', 'All year'],
    ]);
    expect(p.changes[0].details).toEqual([{ label: 'Price', old: '₹1,200/kg', next: '₹1,300/kg' }]);
    const kaju = p.writes.find(w => w.id === 'i1')!;
    expect(kaju.values).toEqual({ price: 1300, rate: 1300, pack_prices: { 250: 336 } });
    expect(kaju.old).toEqual({ price: 1200, rate: 1200, pack_prices: { 250: 310 } });
    expect(p.writes.find(w => w.id === 'i2')).toMatchObject({ values: { occasion_id: 'o2', is_active: false }, old: { occasion_id: null, is_active: true } });
    expect(p.writes[0]).toMatchObject({ id: 'new1', values: { id: 'new1', name: 'Basundi', unit: 'ltr', rate: 300, weight: 1000, weight_unit: 'ltr', occasion_id: null } });
  });

  it('changes the unit and resets pack sizes', () => {
    const p = plan([['Mohanthal', 50, 'piece', '', '']]);
    expect(p.writes[0].values).toEqual({ weight: 1, weight_unit: 'gm', price: 50, unit: 'pc', rate: 50, pack_sizes: null, pack_prices: null });
  });

  it('asks about an unknown occasion and a look-alike name', () => {
    const p = plan([['Kaju Katli', 1200, 'kg', 'Divali', 'Yes'], ['Mohantal', 600, '', '', '']]);
    expect(p.decisions.map(d => [d.text, d.yes, d.no])).toEqual([
      ['Occasion "Divali" is not set up. Did you mean "Diwali"?', 'Use Diwali', 'Leave the occasion out'],
      ['"Mohantal" looks like "Mohanthal", which is already saved.', 'Same sweet — update it', 'Add as new sweet'],
    ]);
    const done = plan([['Kaju Katli', 1200, 'kg', 'Divali', 'Yes'], ['Mohantal', 600, '', '', '']], { 'occ:divali': true, 'same:3': true });
    expect(done.changes.map(c => c.chip)).toEqual(['Same', 'Price changed']);
  });

  it('needs a price for a new sweet and reads the unit from a "Price per litre" header', () => {
    const p = planSweets([{ name: 'S', rows: [['Item', 'Price per litre'], ['Thandai', 280], ['Kulfi', '']] }], data, {}, ids());
    expect(p.writes[0].values).toMatchObject({ name: 'Thandai', unit: 'ltr', rate: 280 });
    expect(p.skipped).toEqual([{ row: 3, name: 'Kulfi', why: 'A new sweet needs a price' }]);
  });

  it('writes only the old columns before the pack-size migration', () => {
    const p = plan([['Mohanthal', 600, '', '', ''], ['Barfi', 500, '', '', '']], {}, { ...data, legacy: true });
    expect(p.writes.map(w => w.values)).toEqual([
      { id: 'new1', name: 'Barfi', occasion_id: null, is_active: true, weight: 1000, weight_unit: 'gm', price: 500 },
      { price: 600 },
    ]);
  });

  it('downloads today\'s sweets, which import back unchanged', () => {
    const sheet = sweetSheet(data);
    expect(sheet[1]).toEqual(['Gulab Jamun', null, 'kg', '', 'Yes']);
    expect(planSweets([{ name: 'S', rows: sheet }], data, {}, ids()).writes).toEqual([]);
  });
});
