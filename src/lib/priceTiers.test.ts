import {
  cleanTiers, rangeLabel, priceAt, priceSpan, followPrice, followsPackage, tierHint, matchPackage,
  toRows, startRows, addRange, dropRange, rowFrom, rowLabel, checkTiers, sampleBooking, sampleWho, sampleBadge,
} from './priceTiers';

const tiers = [{ upto: 150, price: 270 }, { upto: 300, price: 250 }, { upto: null, price: 230 }];
const besic = { id: 'b', name: 'Besic', price_per_plate: 270, price_tiers: tiers, items: ['Puri', 'Dal'], category: 'Gujarati', is_active: true, created_at: '' };
const flat = { ...besic, id: 'f', name: 'Flat', price_per_plate: 200, price_tiers: [] };

describe('price tiers', () => {
  it('cleans saved tiers: sorted, junk and duplicates dropped, one range means one price', () => {
    expect(cleanTiers([{ upto: null, price: 230 }, { upto: 300, price: 250 }, { upto: 150, price: 270 }, { upto: 150, price: 1 }, { upto: -2, price: 9 }, { price: 0 }])).toEqual(tiers);
    expect(cleanTiers([{ upto: null, price: 230 }])).toEqual([]);
    expect(cleanTiers('junk')).toEqual([]);
  });

  it('labels each range', () => {
    expect(tiers.map((_, i) => rangeLabel(tiers, i))).toEqual(['Up to 150 guests', '151 – 300 guests', '301 guests and more']);
    expect(rangeLabel(tiers, 1, true)).toBe('151–300 guests');
  });

  it('prices a guest count, falling back to the one price', () => {
    expect([0, 140, 150, 151, 300, 301, 2000].map(g => priceAt(besic, g))).toEqual([270, 270, 270, 250, 250, 230, 230]);
    expect(priceAt(flat, 500)).toBe(200);
    expect(priceSpan(besic)).toEqual({ low: 230, high: 270 });
    expect(priceSpan(flat)).toEqual({ low: 200, high: 200 });
  });

  it('moves the price with the guest count only while it still follows the package', () => {
    expect(followPrice(besic, 140, 200, 270)).toBe(250);
    expect(followPrice(besic, 140, 145, 270)).toBeNull();
    expect(followPrice(besic, 140, 200, 260)).toBeNull();
    expect(followsPackage(besic, 200, 250)).toBe(true);
    expect(followsPackage(besic, 200, 0)).toBe(false);
  });

  it('writes the hint near the plate price', () => {
    expect(tierHint(besic, 200)).toBe('₹250 a plate for 151–300 guests (Besic)');
    expect(tierHint(besic, 20)).toBe('₹270 a plate for up to 150 guests (Besic)');
    expect(tierHint(besic, 900)).toBe('₹230 a plate for 301 guests and more (Besic)');
  });

  it('finds the tiered package a saved quote still follows', () => {
    expect(matchPackage([flat, besic], ['puri', 'Kheer'], 200, 250)?.id).toBe('b');
    expect(matchPackage([flat, besic], ['puri'], 200, 260)).toBeUndefined();
    expect(matchPackage([besic], ['Kheer'], 200, 250)).toBeUndefined();
  });
});

describe('tier editor rows', () => {
  it('round-trips saved tiers and starts from the one price', () => {
    expect(toRows(tiers)).toEqual([{ upto: '150', price: '270' }, { upto: '300', price: '250' }, { upto: '', price: '230' }]);
    expect(startRows('250')).toEqual([{ upto: '150', price: '250' }, { upto: '', price: '' }]);
  });

  it('adds a range before the open one and keeps the last open when removing', () => {
    expect(addRange(startRows('250')).map(r => r.upto)).toEqual(['150', '300', '']);
    expect(addRange(toRows(tiers)).map(r => r.upto)).toEqual(['150', '300', '450', '']);
    expect(dropRange(toRows(tiers), 2)).toEqual([{ upto: '150', price: '270' }, { upto: '', price: '250' }]);
    expect(rowFrom(toRows(tiers), 2)).toBe(301);
    expect(rowFrom([{ upto: '', price: '' }, { upto: '', price: '' }], 1)).toBeNull();
    expect(toRows(tiers).map((_, i, rows) => rowLabel(rows, i))).toEqual(['Up to 150 guests', '151 – 300 guests', '301 guests and more']);
    expect(rowLabel([{ upto: '', price: '' }, { upto: '', price: '' }], 1)).toBe('… guests and more');
  });

  it('checks limits, prices and the number of ranges', () => {
    expect(checkTiers(toRows(tiers))).toEqual({ tiers, errors: ['', '', ''], error: '' });
    const bad = checkTiers([{ upto: '150', price: '270' }, { upto: '120', price: '250' }, { upto: 'x', price: '' }, { upto: '', price: '' }]);
    expect(bad.errors).toEqual(['', 'Must be more than 150 guests', 'Type the last guest count of this range', 'Type the price per plate']);
    expect(bad.error).toBe('Must be more than 150 guests');
    expect(checkTiers([{ upto: '', price: '250' }]).error).toBe('Add a second guest range, or pick One price');
  });
});

describe('example booking', () => {
  const b = (name: string, date: string, guests: number, extra: object = {}) => ({ customer: { name } as any, event_date: date, guest_count: guests, status: 'followup' as const, ...extra });
  const list = [b('Old', '2026-10-01', 90), b('Kavit Mangrolya', '2026-11-25', 140), b('Rushi', '2026-11-02', 0), b('Gone', '2026-11-03', 50, { status: 'cancelled' })];

  it('picks the soonest upcoming booking, one on the package first', () => {
    expect(sampleBooking(list, 'b', '2026-10-31')).toEqual({ guests: 140, name: 'Kavit Mangrolya', date: '2026-11-25' });
    expect(sampleBooking([...list, b('Mine', '2026-12-30', 400, { menu_id: 'b' })], 'b', '2026-10-31').guests).toBe(400);
    expect(sampleBooking([], 'b', '2026-10-31')).toEqual({ guests: 100 });
  });

  it('describes it for the example line and the tier badge', () => {
    const s = sampleBooking(list, 'b', '2026-10-31');
    expect(sampleWho(s)).toBe('(Kavit Mangrolya, 25 Nov)');
    expect(sampleBadge(s)).toBe('· Kavit, 140 guests');
    expect(sampleWho({ guests: 100 })).toBe('');
    expect(sampleBadge({ guests: 100 })).toBe('· 100 guests');
  });
});
