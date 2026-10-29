// Pricing units, pack sizes and pack prices for items sold by weight, volume or piece.

export type PriceUnit = 'kg' | 'ltr' | 'pc';
// Legacy order lines store grams as 'gm' and millilitres as 'ltr'.
export type LineUnit = 'gm' | 'ltr' | 'pc';

export interface UnitInfo {
  label: string;      // rate label, e.g. "kg"
  base: string;       // pack size label, e.g. "g"
  factor: number;     // base amounts per rate unit
  lineUnit: LineUnit;
  defaults: number[]; // default pack sizes in base amounts
}

export const UNITS: Record<PriceUnit, UnitInfo> = {
  kg:  { label: 'kg',  base: 'g',  factor: 1000, lineUnit: 'gm',  defaults: [250, 500, 750, 1000] },
  ltr: { label: 'ltr', base: 'ml', factor: 1000, lineUnit: 'ltr', defaults: [250, 500, 1000] },
  pc:  { label: 'pc',  base: 'pc', factor: 1,    lineUnit: 'pc',  defaults: [1] },
};

export const UNIT_NAMES: Record<PriceUnit, string> = { kg: 'Per kg', ltr: 'Per litre', pc: 'Per piece' };

export type PackDefaults = Record<PriceUnit, number[]>;
export const DEFAULT_PACKS: PackDefaults = {
  kg: UNITS.kg.defaults, ltr: UNITS.ltr.defaults, pc: UNITS.pc.defaults,
};

export const isPriceUnit = (u: unknown): u is PriceUnit => u === 'kg' || u === 'ltr' || u === 'pc';
export const unitFromLine = (u: LineUnit | string | undefined): PriceUnit =>
  u === 'pc' ? 'pc' : u === 'ltr' ? 'ltr' : 'kg';

const trim = (n: number) => String(Math.round(n * 1000) / 1000);

// "250 g", "1.5 kg", "500 ml", "1 ltr", "6 pcs"
export function formatSize(size: number, unit: PriceUnit): string {
  if (unit === 'pc') return `${trim(size)} ${size === 1 ? 'pc' : 'pcs'}`;
  const info = UNITS[unit];
  return size >= info.factor ? `${trim(size / info.factor)} ${info.label}` : `${trim(size)} ${info.base}`;
}

export const formatLineSize = (weight: number, lineUnit: LineUnit | string) =>
  formatSize(weight, unitFromLine(lineUnit));

export const roundMoney = (n: number) => Math.round(n * 100) / 100;

// Pack price: owner override first, else rate scaled to the pack, rounded to the rupee.
export function packPrice(rate: number, size: number, unit: PriceUnit, overrides?: Record<string, number> | null): number {
  const manual = overrides?.[String(size)];
  if (manual !== undefined && manual !== null && Number.isFinite(Number(manual))) return Number(manual);
  return Math.round((rate * size) / UNITS[unit].factor);
}

// Exact price for a loose weight (not rounded to the rupee).
export const loosePrice = (rate: number, size: number, unit: PriceUnit) =>
  roundMoney((rate * size) / UNITS[unit].factor);

// Size bought for a given amount of money, e.g. ₹100 of a ₹800/kg sweet = 125 g.
export const sizeForAmount = (rate: number, amount: number, unit: PriceUnit) =>
  rate > 0 ? Math.round((amount / rate) * UNITS[unit].factor) : 0;

export const cleanSizes = (sizes: unknown): number[] =>
  Array.isArray(sizes)
    ? Array.from(new Set(sizes.map(Number).filter(n => Number.isFinite(n) && n > 0))).sort((a, b) => a - b)
    : [];

export interface Pack { size: number; label: string; price: number; manual: boolean }

export function buildPacks(
  rate: number, unit: PriceUnit, sizes: number[] | null | undefined,
  overrides: Record<string, number> | null | undefined, defaults: PackDefaults = DEFAULT_PACKS,
): Pack[] {
  const list = sizes && sizes.length ? cleanSizes(sizes) : cleanSizes(defaults[unit]);
  return list.map(size => ({
    size,
    label: formatSize(size, unit),
    price: packPrice(rate, size, unit, overrides),
    manual: overrides?.[String(size)] !== undefined,
  }));
}

// Parses "250", "250g", "0.5 kg", "1.25kg", "500 ml", "2 ltr", "6" into base amounts.
export function parseSize(text: string, unit: PriceUnit): number | null {
  const m = text.trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(kg|kgs|g|gm|gms|gram|grams|l|ltr|litre|liter|ml|pc|pcs)?$/);
  if (!m) return null;
  const n = Number(m[1]);
  const suffix = m[2];
  if (!Number.isFinite(n) || n <= 0) return null;
  if (unit === 'pc') return n;
  if (suffix === 'kg' || suffix === 'kgs' || suffix === 'l' || suffix === 'ltr' || suffix === 'litre' || suffix === 'liter') {
    return Math.round(n * UNITS[unit].factor);
  }
  // Bare numbers under 10 read as kg/ltr ("1.5"), larger ones as g/ml ("250").
  if (!suffix && n < 10) return Math.round(n * UNITS[unit].factor);
  return Math.round(n);
}

export const rateLabel = (rate: number, unit: PriceUnit) =>
  `₹${rate.toLocaleString('en-IN', { maximumFractionDigits: 2 })}/${UNITS[unit].label}`;
