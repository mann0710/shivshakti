import { buildPacks, formatSize, packPrice, parseSize, sizeForAmount, loosePrice } from './units';
import { normalizeItem, baseName, itemPacks, toRow, adjustRate, SeasonalItemRow } from './itemCatalog';
import { planMerge, remapIds, remapLines } from './mergePlan';
import { discountValue, isValidPhone } from './money';

const row = (over: Partial<SeasonalItemRow>): SeasonalItemRow => ({
  id: Math.random().toString(36).slice(2), name: 'Kaju Katli', weight: 1000, weight_unit: 'gm',
  price: 1000, is_active: true, occasion_id: null, created_at: '2026-01-01T00:00:00Z', ...over,
});

describe('units', () => {
  it('labels sizes', () => {
    expect(formatSize(250, 'kg')).toBe('250 g');
    expect(formatSize(1000, 'kg')).toBe('1 kg');
    expect(formatSize(1500, 'kg')).toBe('1.5 kg');
    expect(formatSize(500, 'ltr')).toBe('500 ml');
    expect(formatSize(6, 'pc')).toBe('6 pcs');
  });

  it('auto-calculates 250/500/750/1kg packs from a per-kg rate', () => {
    const packs = buildPacks(850, 'kg', null, null);
    expect(packs.map(p => [p.label, p.price])).toEqual([
      ['250 g', 213], ['500 g', 425], ['750 g', 638], ['1 kg', 850],
    ]);
  });

  it('honours custom sizes and manual pack prices', () => {
    const packs = buildPacks(800, 'kg', [400, 1000], { 400: 330 });
    expect(packs.map(p => [p.size, p.price, p.manual])).toEqual([[400, 330, true], [1000, 800, false]]);
    expect(packPrice(800, 2000, 'kg')).toBe(1600);
  });

  it('parses typed weights', () => {
    expect(parseSize('250', 'kg')).toBe(250);
    expect(parseSize('1.25', 'kg')).toBe(1250);
    expect(parseSize('0.5 kg', 'kg')).toBe(500);
    expect(parseSize('750g', 'kg')).toBe(750);
    expect(parseSize('2 ltr', 'ltr')).toBe(2000);
    expect(parseSize('abc', 'kg')).toBeNull();
    expect(sizeForAmount(800, 100, 'kg')).toBe(125);
    expect(loosePrice(800, 125, 'kg')).toBe(100);
  });
});

describe('item catalog', () => {
  it('derives a per-kg rate from legacy pack rows', () => {
    const item = normalizeItem(row({ weight: 500, price: 450 }));
    expect(item.unit).toBe('kg');
    expect(item.rate).toBe(900);
    expect(itemPacks(item).map(p => [p.size, p.price])).toEqual([[500, 450]]);
  });

  it('reads legacy litre rows as millilitres', () => {
    const item = normalizeItem(row({ weight: 500, weight_unit: 'ltr', price: 60 }));
    expect(item.unit).toBe('ltr');
    expect(item.rate).toBe(120);
  });

  it('writes only legacy columns before the migration', () => {
    const input = { name: ' Barfi ', unit: 'kg' as const, rate: 600, pack_sizes: [250], pack_prices: null, category: 'Sweets', occasion_id: null, is_active: true };
    expect(toRow(input, true)).toEqual({ name: 'Barfi', occasion_id: null, is_active: true, weight: 1000, weight_unit: 'gm', price: 600 });
    expect(toRow(input, false)).toMatchObject({ unit: 'kg', rate: 600, pack_sizes: [250], category: 'Sweets' });
  });

  it('strips weights from names', () => {
    expect(baseName('Kaju Katli - 500 gm')).toBe('Kaju Katli');
    expect(baseName('Kaju Katli (1 kg)')).toBe('Kaju Katli');
    expect(baseName('Rasgulla 1/2 kg')).toBe('Rasgulla');
    expect(baseName('Mango Lassi 250ml')).toBe('Mango Lassi');
    expect(baseName('Kaju Katli')).toBe('Kaju Katli');
  });

  it('adjusts rates in bulk with rounding', () => {
    expect(adjustRate(850, 'percent', 10, 10)).toBe(940);
    expect(adjustRate(850, 'amount', -50, 1)).toBe(800);
  });
});

describe('merge plan', () => {
  it('folds one-row-per-pack duplicates into one item and keeps exact prices', () => {
    const items = [
      row({ id: 'a', name: 'Kaju Katli 250 gm', weight: 250, price: 260 }),
      row({ id: 'b', name: 'Kaju Katli 500 gm', weight: 500, price: 500 }),
      row({ id: 'c', name: 'Kaju Katli 1 kg', weight: 1000, price: 1000 }),
      row({ id: 'd', name: 'Soan Papdi', weight: 1000, price: 400 }),
    ].map(normalizeItem);
    const plans = planMerge(items);
    expect(plans).toHaveLength(1);
    const [p] = plans;
    expect(p.keepId).toBe('c');
    expect(p.removeIds.sort()).toEqual(['a', 'b']);
    expect(p.update).toMatchObject({ name: 'Kaju Katli', rate: 1000, pack_sizes: null, pack_prices: { 250: 260 } });
    expect(p.preview.map(r => [r.size, r.newPrice])).toEqual([[250, 260], [500, 500], [750, 750], [1000, 1000]]);
    expect(p.preview.filter(r => r.oldPrice === null).map(r => r.size)).toEqual([750]);
    expect(p.conflicts).toEqual([]);
  });

  it('keeps non-default sizes and flags price clashes', () => {
    const items = [
      row({ id: 'a', name: 'Barfi', weight: 400, price: 300 }),
      row({ id: 'b', name: 'barfi', weight: 400, price: 320, created_at: '2026-02-01T00:00:00Z' }),
    ].map(normalizeItem);
    const [p] = planMerge(items);
    expect(p.update.pack_sizes).toEqual([250, 400, 500, 750, 1000]);
    expect(p.conflicts).toHaveLength(1);
  });

  it('does not merge across occasions', () => {
    const items = [
      row({ id: 'a', weight: 500, price: 500, occasion_id: 'diwali' }),
      row({ id: 'b', weight: 1000, price: 1000, occasion_id: 'holi' }),
    ].map(normalizeItem);
    const plans = planMerge(items);
    expect(plans).toHaveLength(1);
    expect(plans[0].removeIds).toEqual([]);
  });

  it('remaps old order lines to the kept item', () => {
    const map = remapIds([{ keepId: 'c', removeIds: ['a'] } as any]);
    expect(remapLines([{ item_id: 'a' }, { item_id: 'x' }], map)).toEqual([{ item_id: 'c' }, { item_id: 'x' }]);
    expect(remapLines([{ item_id: 'x' }], map)).toBeNull();
  });
});

describe('money', () => {
  it('caps discounts', () => {
    expect(discountValue(1000, 10, 'percentage')).toBe(100);
    expect(discountValue(1000, 5000, 'amount')).toBe(1000);
    expect(discountValue(1000, -5, 'amount')).toBe(0);
  });
  it('validates Indian mobiles', () => {
    expect(isValidPhone('+91 98795 29967')).toBe(true);
    expect(isValidPhone('12345')).toBe(false);
  });
});
