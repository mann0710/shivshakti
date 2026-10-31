import { matchHeaders, readBody, parseAmount, shapeCounts, parseYesNo, similarity, fuzzy, matchKey, parsePasteList, Column, claims } from './importPlan';

const COLS: Column[] = [
  { key: 'cat', label: 'Category', names: ['category', 'cat'] },
  { key: 'sub', label: 'Subcategory', names: ['subcategory', 'sub category'] },
  { key: 'name', label: 'Dish', names: ['dish', 'item', 'name'], required: true },
  { key: 'price', label: 'Price', names: ['price', 'rate'] },
];

describe('import columns', () => {
  it('matches headers loosely: case, spaces and synonyms', () => {
    expect(matchHeaders(['CATEGORY ', 'Sub Category', 'Item Name', 'Rate (₹)'], COLS)).toEqual({ cat: 0, sub: 1, name: 2, price: 3 });
    expect(matchHeaders(['Main Category', 'Subcategory'], COLS)).toEqual({ sub: 1, cat: 0 });
    expect(matchHeaders(['Notes'], COLS)).toEqual({});
  });

  it('finds the header row and best sheet, keeps Excel row numbers and drops blank rows', () => {
    const body = readBody([
      { name: 'Notes', rows: [['hello']] },
      { name: 'Menu', rows: [['Our menu 2026'], ['Dish', 'Price'], ['Raj Kachori', 60], [null, ''], ['Papdi Chaat', '45']] },
    ], COLS);
    expect(body.sheet).toBe('Menu');
    expect(body.cols).toEqual({ name: 0, price: 1 });
    expect(body.rows.map(r => r.row)).toEqual([3, 5]);
    expect(body.missing).toEqual([]);
  });

  it('names the required columns it could not find', () => {
    expect(readBody([{ name: 'S', rows: [['Category', 'Price'], ['x', 1]] }], COLS).missing).toEqual(['Dish']);
  });
});

describe('amounts and yes/no', () => {
  it('reads clean numbers, flags messy ones and rejects ranges', () => {
    expect(parseAmount(60)).toEqual({ kind: 'ok', value: 60 });
    expect(parseAmount('1,200')).toEqual({ kind: 'ok', value: 1200 });
    expect(parseAmount('')).toEqual({ kind: 'empty' });
    expect(parseAmount('-')).toEqual({ kind: 'empty' });
    expect(parseAmount('-5')).toEqual({ kind: 'bad' });
    expect(parseAmount('₹ 60/-')).toEqual({ kind: 'messy', value: 60, shape: '₹ #/-' });
    expect(parseAmount('Rs. 1,250.50')).toEqual({ kind: 'messy', value: 1250.5, shape: 'rs. #' });
    expect(parseAmount('40-50')).toEqual({ kind: 'bad' });
    expect(parseAmount('on request')).toEqual({ kind: 'bad' });
  });

  it('counts messy cells by how they are written', () => {
    expect(Array.from(shapeCounts(['₹ 60/-', '₹ 45/-', 'Rs 20', 30]))).toEqual([['₹ #/-', 2], ['rs #', 1]]);
  });

  it('reads yes / no words', () => {
    expect(['Yes', 'y', 'Shown', true].map(parseYesNo)).toEqual([true, true, true, true]);
    expect(['No', 'hidden', 'OFF', false].map(parseYesNo)).toEqual([false, false, false, false]);
    expect(['', 'maybe', null].map(parseYesNo)).toEqual([null, null, null]);
  });
});

describe('look-alike names', () => {
  it('treats spacing and punctuation as the same name', () => {
    expect(matchKey('Dahi-Puri')).toBe(matchKey(' dahi  puri '));
    expect(matchKey('Pani Puri (5 flavour)')).not.toBe(matchKey('Pani Puri'));
  });

  it('scores Indian spelling variants as close', () => {
    expect(similarity('Kaju Cassata', 'Kaju Kasata')).toBe(1);
    expect(similarity('Paneer Tikka', 'Panir Tika')).toBe(1);
    expect(similarity('Raj Kachori', 'Moong Dal Chilla')).toBeLessThan(0.5);
    expect(similarity('Delhi Chaat', 'Delhi Ki Chaat', true)).toBeGreaterThanOrEqual(0.9);
  });

  it('picks the closest name above the bar', () => {
    const subs = [{ name: 'Delhi Ki Chaat' }, { name: 'Agra Ki Chaat' }, { name: 'Indori Chaat' }];
    const near = fuzzy(subs, s => s.name, true);
    expect(near('Delhi Chaat', 0.7)?.name).toBe('Delhi Ki Chaat');
    expect(near('Chinese', 0.7)).toBeUndefined();
  });

  it('hands each saved row to one file row', () => {
    const c = claims([{ id: 'a', name: 'Samosa' }, { id: 'b', name: 'Samosa' }], x => matchKey(x.name));
    expect(c.take(c.find('samosa')!).id).toBe('a');
    expect(c.find('samosa')?.id).toBe('b');
  });
});

describe('pasted lists', () => {
  it('reads WhatsApp lines with prices in many forms', () => {
    const text = 'Raj Kachori 60\n\nDahi Puri - 50\nPani Puri (5 flavour) 40\n*Kulfi* ₹ 60/-\n1. Papdi Chaat Rs.45\nMoong Dal Chilla\nSamosa 2 pcs 30\nPaneer65';
    expect(parsePasteList(text).map(l => [l.line, l.name, l.price])).toEqual([
      [1, 'Raj Kachori', 60], [3, 'Dahi Puri', 50], [4, 'Pani Puri (5 flavour)', 40], [5, 'Kulfi', 60],
      [6, 'Papdi Chaat', 45], [7, 'Moong Dal Chilla', null], [8, 'Samosa 2 pcs', 30], [9, 'Paneer65', null],
    ]);
  });

  it('reads tab-separated Excel rows', () => {
    expect(parsePasteList('Raj Kachori\t60\nAloo Tikki\t\t₹45\n\t\nDahi Balla\t').map(l => [l.name, l.price])).toEqual([
      ['Raj Kachori', 60], ['Aloo Tikki', 45], ['Dahi Balla', null],
    ]);
  });

  it('keeps the whole line so a dish like "Paneer 65" can be recognised', () => {
    expect(parsePasteList('Paneer 65')[0]).toMatchObject({ name: 'Paneer', price: 65, whole: 'Paneer 65' });
  });
});
