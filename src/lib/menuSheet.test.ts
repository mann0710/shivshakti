import {
  applyStyles, cellErrors, changesOf, cleanPrice, Edits, merged, parseClip, parseShown, pasteGrid, pctPrice, planSave,
  readPrice, rowOf, saveGroups, setCell, setMany, summary, toggleStyle, wasText,
} from './menuSheet';
import type { Dish } from './menuCatalog';

const at = '2026-01-01T00:00:00Z';
const dish = (id: string, name: string, default_price: number | null = null, food_styles: string[] | null = null, is_active = true, subcategory_id = 's1'): Dish =>
  ({ id, name, default_price, food_styles, is_active, subcategory_id, created_at: at });
const dishes = [dish('d1', 'Albeli Chaat'), dish('d2', 'Aloo Tikki', 45, ['swaminarayan']), dish('d3', 'Dahi Balla', 60, ['jain', 'swaminarayan'], false)];
const bases = dishes.map(rowOf);
const names = (id: string) => ({ s1: 'Delhi Ki Chaat', s2: 'Agra Ki Chaat' } as Record<string, string>)[id] ?? id;

describe('menu sheet', () => {
  it('reads a dish as text cells', () => {
    expect(bases[1]).toEqual({ id: 'd2', name: 'Aloo Tikki', price: '45', styles: ['swaminarayan'], shown: true, sub: 's1' });
    expect(bases[0].price).toBe('');
    expect(rowOf(dish('x', 'X', null, ['onion_garlic', 'jain', 'bogus'])).styles).toEqual(['jain', 'onion_garlic']);
  });

  it('keeps prices numeric: empty clears, 0 and words are errors', () => {
    expect(readPrice('')).toEqual({ ok: true, value: null });
    expect(readPrice(' ₹1,200 ').value).toBe(1200);
    expect(readPrice('55.555').value).toBe(55.56);
    expect(readPrice('0').error).toBe('Above ₹0, or leave empty');
    expect(readPrice('abc').error).toBe('Numbers only');
    expect(readPrice('-5').ok).toBe(false);
    expect(cleanPrice('Rs. 1,200/-')).toBe('1200');
  });

  it('reads shown / hidden words', () => {
    expect(['Shown', 'yes', 'Y', '1', 'on'].map(parseShown)).toEqual([true, true, true, true, true]);
    expect(['Hidden', 'no', '0', 'hide'].map(parseShown)).toEqual([false, false, false, false]);
    expect(parseShown('maybe')).toBeNull();
  });

  it('sets cells and drops a change typed back to the saved value', () => {
    let e: Edits = setCell({}, bases[0], 'price', '55');
    expect(e).toEqual({ d1: { price: '55' } });
    e = setCell(e, bases[0], 'name', 'Albeli');
    e = setCell(e, bases[0], 'price', '');
    expect(e).toEqual({ d1: { name: 'Albeli' } });
    e = setCell(e, bases[0], 'name', 'Albeli Chaat');
    expect(e).toEqual({});
    expect(setCell({}, bases[1], 'styles', ['swaminarayan'])).toEqual({});
  });

  it('keeps half-typed text but does not count it as a change', () => {
    const e = setCell(setCell({}, bases[1], 'price', '45.'), bases[0], 'name', 'Albeli Chaat ');
    expect(e.d2.price).toBe('45.');
    expect(changesOf(bases, e)).toEqual([]);
  });

  it('lists changes with old and new text, and sums them up', () => {
    let e = setCell({}, bases[0], 'price', '55');
    e = setCell(e, bases[1], 'price', '50');
    e = setCell(e, bases[1], 'name', 'Aloo Tikki With Chutney');
    e = setCell(e, bases[2], 'shown', true);
    e = setCell(e, bases[0], 'sub', 's2');
    const list = changesOf(bases, e, names);
    expect(list.map(c => [c.dish, c.field, c.from, c.to])).toEqual([
      ['Albeli Chaat', 'price', 'empty', '₹55'], ['Albeli Chaat', 'sub', 'Delhi Ki Chaat', 'Agra Ki Chaat'],
      ['Aloo Tikki', 'name', '"Aloo Tikki"', '"Aloo Tikki With Chutney"'], ['Aloo Tikki', 'price', '₹45', '₹50'],
      ['Dahi Balla', 'shown', 'Hidden', 'Shown'],
    ]);
    expect(summary(list)).toBe('2 prices, 1 name, 1 move, 1 shown');
    expect(wasText('price', '')).toBe('was empty');
    expect(wasText('name', 'Old name')).toBe('was "Old name"');
    expect(wasText('styles', [])).toBe('was none');
  });

  it('changes prices by a percent in whole rupees and skips empty ones', () => {
    expect(pctPrice(55, 10)).toBe(61);
    expect(pctPrice(45, 10)).toBe(50);
    expect(pctPrice(25, -10)).toBe(23);
    expect(pctPrice(2, -90)).toBe(1);
    const e = setMany({}, bases, 'price', r => (readPrice(r.price).value ? String(pctPrice(readPrice(r.price).value!, 10)) : undefined));
    expect(e).toEqual({ d2: { price: '50' }, d3: { price: '66' } });
  });

  it('adds and removes food styles, leaving the rest', () => {
    expect(applyStyles(['swaminarayan'], { jain: true })).toEqual(['jain', 'swaminarayan']);
    expect(applyStyles(['jain', 'swaminarayan'], { jain: false })).toEqual(['swaminarayan']);
    expect(applyStyles(['jain'], { onion_garlic: true, jain: false })).toEqual(['onion_garlic']);
    expect(toggleStyle(['swaminarayan'], 'jain')).toEqual(['jain', 'swaminarayan']);
    expect(toggleStyle(['jain', 'swaminarayan'], 'jain')).toEqual(['swaminarayan']);
  });

  it('flags bad prices and empty or repeated names only where changed', () => {
    const others = [{ id: 'o1', name: 'Pani Puri', subcategory_id: 's2' }, { id: 'o2', name: 'Pani Puri', subcategory_id: 's2' }];
    let e = setCell({}, bases[0], 'price', '0');
    e = setCell(e, bases[1], 'name', '  ');
    e = setCell(e, bases[2], 'name', 'albeli chaat');
    expect(cellErrors(bases, e, others)).toEqual({
      d1: { price: 'Above ₹0, or leave empty' }, d2: { name: 'Type a name' }, d3: { name: 'Another dish here has this name' },
    });
    const moved = setCell(setCell({}, bases[0], 'sub', 's2'), bases[0], 'name', 'Pani Puri');
    expect(cellErrors(bases, moved, others).d1?.name).toBe('Another dish here has this name');
    expect(cellErrors(bases, setCell({}, bases[0], 'price', '40'), others)).toEqual({});
  });

  it('parses an Excel block and pastes it down a column', () => {
    expect(parseClip('55\r\n45\r\n')).toEqual([['55'], ['45']]);
    expect(parseClip('"Say ""hi"""\tJain')).toEqual([['Say "hi"', 'Jain']]);
    const r = pasteGrid({}, bases, { r: 1, c: 1 }, [['50'], ['Rs 70'], ['80']]);
    expect(r.edits).toEqual({ d2: { price: '50' }, d3: { price: '70' } });
    expect([r.cells, r.extra]).toEqual([2, 1]);
  });

  it('pastes across columns with each column read its own way', () => {
    const r = pasteGrid({}, bases, { r: 0, c: 2 }, [['Jain, Swaminarayan', 'Hidden', 'spare']]);
    expect(merged(bases[0], r.edits)).toMatchObject({ styles: ['jain', 'swaminarayan'], shown: false });
    expect(r.cells).toBe(2);
    const noPrice = pasteGrid({}, bases, { r: 0, c: 1 }, [['onion', 'no']], ['name', 'styles', 'shown']);
    expect(noPrice.edits).toEqual({ d1: { styles: ['onion_garlic'], shown: false } });
    // Before the food styles migration the column is left out, so nothing sends food_styles.
    const noStyles = pasteGrid({}, bases, { r: 0, c: 0 }, [['Albeli', '40', 'no', 'Jain']], ['name', 'price', 'shown']);
    expect(noStyles.edits).toEqual({ d1: { name: 'Albeli', price: '40', shown: false } });
    expect(planSave(dishes, noStyles.edits).items[0].patch).not.toHaveProperty('food_styles');
  });

  it('plans patches with the old values for undo', () => {
    let e = setCell({}, bases[0], 'price', '55');
    e = setCell(e, bases[1], 'styles', ['jain', 'swaminarayan']);
    e = setCell(e, bases[1], 'name', ' Aloo Tikki Chaat ');
    e = setCell(e, bases[2], 'shown', true);
    const { items, undo } = planSave(dishes, e);
    expect(items).toEqual([
      { id: 'd1', patch: { default_price: 55 } },
      { id: 'd2', patch: { name: 'Aloo Tikki Chaat', food_styles: ['jain', 'swaminarayan'] } },
      { id: 'd3', patch: { is_active: true } },
    ]);
    expect(undo).toEqual([
      { table: 'menu_items', id: 'd1', values: { default_price: null } },
      { table: 'menu_items', id: 'd2', values: { name: 'Aloo Tikki', food_styles: ['swaminarayan'] } },
      { table: 'menu_items', id: 'd3', values: { is_active: false } },
    ]);
    expect(planSave(dishes, setCell({}, bases[0], 'price', 'abc')).items).toEqual([]);
  });

  it('groups identical patches into one request per 100 dishes', () => {
    const items = Array.from({ length: 150 }, (_, i) => ({ id: `d${i}`, patch: { is_active: false } }));
    const groups = saveGroups([...items, { id: 'x', patch: { default_price: 40 } }, { id: 'y', patch: { default_price: 40 } }]);
    expect(groups.map(g => g.ids.length)).toEqual([100, 50, 2]);
    expect(groups[2].patch).toEqual({ default_price: 40 });
  });
});
