import {
  PriceUnit, UNITS, isPriceUnit, cleanSizes, buildPacks, Pack, PackDefaults, DEFAULT_PACKS, roundMoney,
} from './units';

// Raw seasonal_items row; the newer columns exist only after the pack-sizes migration.
export interface SeasonalItemRow {
  id: string;
  name: string;
  weight: number;
  weight_unit: string;
  price: number;
  is_active: boolean;
  occasion_id?: string | null;
  created_at: string;
  unit?: string | null;
  rate?: number | null;
  pack_sizes?: number[] | null;
  pack_prices?: Record<string, number> | null;
  category?: string | null;
}

export interface SeasonalItem extends SeasonalItemRow {
  unit: PriceUnit;
  rate: number;
  pack_sizes: number[] | null;
  pack_prices: Record<string, number> | null;
  category: string | null;
}

export interface ItemInput {
  name: string;
  unit: PriceUnit;
  rate: number;
  pack_sizes: number[] | null;
  pack_prices: Record<string, number> | null;
  category: string | null;
  occasion_id: string | null;
  is_active: boolean;
}

const legacyUnit = (weightUnit: string): PriceUnit => (weightUnit === 'ltr' ? 'ltr' : 'kg');

export function normalizeItem(row: SeasonalItemRow): SeasonalItem {
  const unit = isPriceUnit(row.unit) ? row.unit : legacyUnit(row.weight_unit);
  const weight = Number(row.weight) || 0;
  const price = Number(row.price) || 0;
  const legacyRate = weight > 0 ? roundMoney((price * UNITS[unit].factor) / weight) : price;
  const rate = row.rate !== null && row.rate !== undefined ? Number(row.rate) : legacyRate;
  const sizes = cleanSizes(row.pack_sizes);
  return {
    ...row,
    unit,
    rate,
    pack_sizes: sizes.length ? sizes : null,
    pack_prices: row.pack_prices && typeof row.pack_prices === 'object' ? row.pack_prices : null,
    category: row.category?.trim() || null,
  };
}

// Pack size a legacy one-row-per-pack item stood for; null for rate-based items.
export const legacySize = (item: SeasonalItem): number | null =>
  item.pack_sizes || item.weight === UNITS[item.unit].factor ? null : Number(item.weight) || null;

export const itemPacks = (item: SeasonalItem, defaults: PackDefaults = DEFAULT_PACKS): Pack[] => {
  const legacy = legacySize(item);
  return buildPacks(item.rate, item.unit, legacy ? [legacy] : item.pack_sizes, legacy ? { [legacy]: item.price } : item.pack_prices, defaults);
};

// Row payload; legacy mode writes only the original columns, mirroring the rate as a 1 kg / 1 ltr pack.
export function toRow(input: ItemInput, legacy: boolean): Record<string, unknown> {
  const factor = UNITS[input.unit].factor;
  const base = {
    name: input.name.trim(),
    occasion_id: input.occasion_id || null,
    is_active: input.is_active,
    weight: factor,
    weight_unit: input.unit === 'ltr' ? 'ltr' : 'gm',
    price: input.rate,
  };
  if (legacy) return base;
  return {
    ...base,
    unit: input.unit,
    rate: input.rate,
    pack_sizes: input.pack_sizes && input.pack_sizes.length ? cleanSizes(input.pack_sizes) : null,
    pack_prices: input.pack_prices && Object.keys(input.pack_prices).length ? input.pack_prices : null,
    category: input.category?.trim() || null,
  };
}

export const toInput = (item: SeasonalItem): ItemInput => ({
  name: item.name,
  unit: item.unit,
  rate: item.rate,
  pack_sizes: item.pack_sizes,
  pack_prices: item.pack_prices,
  category: item.category,
  occasion_id: item.occasion_id ?? null,
  is_active: item.is_active,
});

const WEIGHT_TOKEN =
  /[([]?\s*(?:\d+\s*\/\s*\d+|[½¼¾]|\d+(?:\.\d+)?)\s*(?:kgs?|gms?|grams?|g|ml|ltrs?|litres?|liters?|lt|l)\b\.?\s*[)\]]?/gi;

// "Kaju Katli - 500 gm" -> "Kaju Katli"
export function baseName(name: string): string {
  const stripped = name.replace(WEIGHT_TOKEN, ' ').replace(/\s+/g, ' ').trim();
  const cleaned = stripped.replace(/^[\s\-–|,:/]+|[\s\-–|,:/]+$/g, '').trim();
  return cleaned || name.trim();
}

export const nameKey = (name: string) => baseName(name).toLowerCase();
export const hasWeightToken = (name: string) => baseName(name) !== name.trim();

// Bulk price change: percentage or flat rupees, then rounded to the nearest step.
export function adjustRate(rate: number, mode: 'percent' | 'amount', value: number, roundTo: number): number {
  const next = mode === 'percent' ? rate * (1 + value / 100) : rate + value;
  const step = roundTo > 0 ? roundTo : 1;
  return Math.max(0, Math.round(next / step) * step);
}
