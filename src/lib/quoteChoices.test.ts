import { plateRange, servedItems, acceptPatch, pickKey, choiceGroups, setGroupMeta, ungroup, atMaxPrices, addAlternative, togglePicked, tidyGroups, setPickPrices, pickRange, onePickPrice, ownRange } from './quoteChoices';
import { quoteTotals } from './quoteMath';
import { nextLabel, sameDayNote, statusText, totalText, quoteDays, siblingsOf } from './quoteOptions';

const sweet = { id: 'g1', label: 'Sweets', pick: 2 };
const dish = (id: string, amount: number, choice?: object, chosen?: boolean) =>
  ({ item_id: id, item_name: id, category_name: 'Menu', subcategory_name: '', amount, choice, chosen }) as any;
const items = [dish('paneer', 300), dish('dal', 320),
  dish('jamun', 40, sweet), dish('rasmalai', 45, sweet), dish('halwa', 50, sweet), dish('jalebi', 55, sweet), dish('kulfi', 65, sweet)];

describe('choose-any pricing', () => {
  it('ranges from the cheapest to the dearest picks', () => {
    expect(plateRange(items)).toEqual({ min: 705, max: 740 });
  });
  it('included groups and picked dishes fix the price', () => {
    expect(plateRange(setGroupMeta(items, 'g1', { included: true }))).toEqual({ min: 620, max: 620 });
    const picked = items.map(i => (['rasmalai', 'jalebi'].includes(i.item_id) ? { ...i, chosen: true } : i));
    expect(plateRange(picked)).toEqual({ min: 720, max: 720 });
    expect(servedItems(picked).map(i => i.item_id)).toEqual(['paneer', 'dal', 'rasmalai', 'jalebi']);
  });
  it('groups and ungroups dishes', () => {
    expect(choiceGroups(items)[0].items).toHaveLength(5);
    expect(choiceGroups(ungroup(items, 'g1'))).toHaveLength(0);
  });
});

describe('alternatives', () => {
  const menu = [dish('ladoo', 0), dish('puri', 0)];
  menu[0].subcategory_name = 'Gujarati Sweet';
  it('offers a dish instead of another, right after it', () => {
    const next = addAlternative(menu, { itemId: 'ladoo' }, dish('mohanthal', 0));
    expect(next.map(i => i.item_id)).toEqual(['ladoo', 'mohanthal', 'puri']);
    expect(choiceGroups(next)[0].meta).toMatchObject({ label: 'Gujarati Sweet', pick: 1 });
    const third = addAlternative(next, { groupId: choiceGroups(next)[0].meta.id }, dish('magas', 0));
    expect(choiceGroups(third)[0].items.map(i => i.item_id)).toEqual(['ladoo', 'mohanthal', 'magas']);
  });
  it('moves a dish already in the menu into the choice', () => {
    const next = addAlternative(menu, { itemId: 'ladoo' }, menu[1]);
    expect(next).toHaveLength(2);
    expect(choiceGroups(next)[0].items.map(i => i.item_id)).toEqual(['ladoo', 'puri']);
  });
  it('records the pick: switches for choose 1, stops at the limit otherwise', () => {
    const g = addAlternative(menu, { itemId: 'ladoo' }, dish('mohanthal', 0));
    const a = togglePicked(g, 'ladoo');
    const b = togglePicked(a, 'mohanthal');
    expect(b.filter(i => i.chosen).map(i => i.item_id)).toEqual(['mohanthal']);
    const two = setGroupMeta(items, 'g1', { pick: 2 });
    const full = togglePicked(togglePicked(two, 'jamun'), 'halwa');
    expect(togglePicked(full, 'kulfi').filter(i => i.chosen)).toHaveLength(2);
  });
  it('a group left with one dish becomes a normal dish', () => {
    const g = addAlternative(menu, { itemId: 'ladoo' }, dish('mohanthal', 0));
    expect(choiceGroups(tidyGroups(g.filter(i => i.item_id !== 'mohanthal')))).toHaveLength(0);
  });
});

describe('accepting picks', () => {
  const quote = { id: 'q', items, per_plate_amount: 705, per_plate_max: 740, guest_count: 180, subtotal: 126900, discount_amount: 900,
    additional_discounts: [{ id: 'd', description: 'Discount', amount: 900 }], gst_rate: 5, extra_charges: [], transportation_charges: [{ description: 'Van', amount: 1000 }] } as any;
  it('locks the price to the picked dishes and recalculates totals', () => {
    const p = acceptPatch(quote, new Set([pickKey('rasmalai'), pickKey('jalebi')]), 200);
    expect(p.per_plate_amount).toBe(720);
    expect(p.subtotal).toBe(144000);
    // (144000 − 900) × 5% = 7155; total = 143100 + 7155 + 1000
    expect(p.gst_amount).toBe(7155);
    expect(p.total_amount).toBe(151255);
    expect(p.per_plate_max).toBeNull();
    expect((p.items ?? []).filter(i => i.chosen).map(i => i.item_id)).toEqual(['rasmalai', 'jalebi']);
  });
  it('keeps a fixed plate price fixed', () => {
    const p = acceptPatch({ ...quote, per_plate_max: null, per_plate_amount: 650 }, new Set([pickKey('jamun')]));
    expect(p.per_plate_amount).toBe(650);
  });
  it('works per meal on multi-day quotes', () => {
    const meal = { id: 'm1', meal_type: 'lunch', time: '', guest_count: 100, per_plate_amount: 705, per_plate_max: 740, discount_amount: 0, items, subtotal: 70500 };
    const q = { ...quote, is_multi_day: true, event_days: [{ day_number: 1, date: '2026-12-20', meals: [meal], day_subtotal: 70500 }], additional_discounts: [], gst_rate: 0, transportation_charges: [] };
    expect(atMaxPrices(q.event_days)[0].day_subtotal).toBe(74000);
    const p = acceptPatch(q, new Set([pickKey('kulfi', 'm1'), pickKey('jalebi', 'm1')]));
    expect(p.event_days?.[0].meals[0].per_plate_amount).toBe(740);
    expect(p.total_amount).toBe(74000);
  });
});

describe('totals', () => {
  it('matches the editor formula', () => {
    expect(quoteTotals({ isMultiDay: false, eventDays: [], perPlate: 500, guests: 100, additional: [{ amount: 1000 }], gstRate: 18, extra: 500, transport: 0 }))
      .toEqual({ subtotal: 50000, mealSavings: 0, discount: 1000, gst: 8820, final: 58320 });
  });
});

describe('options', () => {
  const q = (o: object) => ({ id: 'x', status: 'sent', created_at: '2026-10-01', total_amount: 1000, ...o }) as any;
  it('labels, statuses and ranges', () => {
    expect(nextLabel([q({ option_label: 'A' }), q({ option_label: 'B' })])).toBe('C');
    expect(statusText(q({ status: 'rejected', option_group: 'g' }))).toBe('Not chosen');
    expect(statusText(q({ status: 'rejected' }))).toBe('Rejected');
    expect(totalText(q({ total_max: 1500 }))).toBe('₹1,000 – ₹1,500');
    const all = [q({ id: 'b', option_group: 'g', option_label: 'B' }), q({ id: 'a', option_group: 'g', option_label: 'A' }), q({ id: 'c' })];
    expect(siblingsOf(all[0], all).map(s => s.id)).toEqual(['a', 'b']);
  });
  it('lists the dates a quote covers', () => {
    expect(quoteDays(q({ booking: { event_date: '2026-12-19', end_date: '2026-12-21' } }))).toEqual(['2026-12-19', '2026-12-20', '2026-12-21']);
  });
  it('warns about other quotes and a booked venue on the same day', () => {
    const others = [q({ id: 'p', status: 'accepted', customer: { name: 'Rajesh' }, booking: { event_date: '2026-12-20', venue: 'Plot' } })];
    const booked = [{ id: 'b1', status: 'confirmed', venue: 'Plot', event_date: '2026-12-20' }] as any;
    const note = sameDayNote('2026-12-20', 'plot', others, booked, { id: 'new' });
    expect(note).toContain('1 other quote: Rajesh (accepted, Plot)');
    expect(note).toContain('plot is already booked');
    expect(sameDayNote('2026-12-21', 'plot', others, booked, {})).toBe('');
  });
});

describe('one price for any pick', () => {
  const sabji = { id: 'g2', label: 'Sabji', pick: 1 };
  const menu = [dish('roti', 20), dish('paneer', 45, sabji), dish('kofta', 55, sabji), dish('mixveg', 30, { id: 'g3', label: 'Sabji', pick: 1 }), dish('bhindi', 30, { id: 'g3', label: 'Sabji', pick: 1 })];
  it('knows the range picks would make, and when every choice keeps one price', () => {
    expect(pickRange(menu)).toEqual({ min: 95, max: 105 });
    expect(onePickPrice(menu)).toBe(false);
    const fixed = setPickPrices(menu, true);
    expect(onePickPrice(fixed)).toBe(true);
    expect(pickRange(fixed)).toEqual({ min: 95, max: 105 });
    expect(pickRange([dish('roti', 20)])).toBeNull();
  });
  it('a typed price stays put whatever the customer picks once every choice keeps one price', () => {
    const fixed = setPickPrices(menu, true);
    expect(ownRange(105, fixed)).toEqual({ low: 105, high: null });
    expect(ownRange(105, togglePicked(fixed, 'paneer'))).toEqual({ low: 105, high: null });
    expect(onePickPrice(setPickPrices(fixed, false))).toBe(false);
  });
});
