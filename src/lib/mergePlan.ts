import { SeasonalItem, legacySize, nameKey, baseName } from './itemCatalog';
import { UNITS, DEFAULT_PACKS, PackDefaults, cleanSizes, packPrice, formatSize, roundMoney } from './units';

// Turns one-row-per-pack items ("Kaju Katli 250 g", "Kaju Katli 500 g") into one rate-based item.

export interface MergePreviewRow { size: number; label: string; oldPrice: number | null; newPrice: number }

export interface MergeGroup {
  key: string;
  keepId: string;
  removeIds: string[];
  sourceNames: string[];
  update: {
    name: string;
    unit: SeasonalItem['unit'];
    rate: number;
    pack_sizes: number[] | null;
    pack_prices: Record<string, number> | null;
    is_active: boolean;
    category: string | null;
    weight: number;
    weight_unit: string;
    price: number;
  };
  preview: MergePreviewRow[];
  conflicts: string[];
}

const groupKey = (i: SeasonalItem) => `${nameKey(i.name)}|${i.unit}|${i.occasion_id ?? ''}`;

// Sizes a row really priced: its own pack, its explicit sizes, or 1 kg / 1 ltr / 1 pc at the rate.
const sizesOf = (i: SeasonalItem): number[] => {
  const legacy = legacySize(i);
  return legacy ? [legacy] : i.pack_sizes ?? [UNITS[i.unit].factor];
};

const pickKeeper = (rows: SeasonalItem[], factor: number) =>
  [...rows].sort((a, b) =>
    Number(b.weight === factor) - Number(a.weight === factor)
    || Number(b.is_active) - Number(a.is_active)
    || a.created_at.localeCompare(b.created_at),
  )[0];

// Rate from the 1 kg row when present, else from the biggest pack.
function pickRate(rows: SeasonalItem[], factor: number): number {
  const full = rows.find(r => legacySize(r) === null && r.weight === factor);
  if (full) return full.rate;
  const biggest = [...rows].sort((a, b) => Math.max(...sizesOf(b), 0) - Math.max(...sizesOf(a), 0))[0];
  return biggest.rate;
}

function needsWork(rows: SeasonalItem[]): boolean {
  if (rows.length > 1) return true;
  const [only] = rows;
  return legacySize(only) !== null || baseName(only.name) !== only.name.trim();
}

export function planMerge(items: SeasonalItem[], defaults: PackDefaults = DEFAULT_PACKS): MergeGroup[] {
  const groups = new Map<string, SeasonalItem[]>();
  items.forEach(i => groups.set(groupKey(i), [...(groups.get(groupKey(i)) ?? []), i]));

  const plans: MergeGroup[] = [];
  groups.forEach((rows, key) => {
    if (!needsWork(rows)) return;
    const unit = rows[0].unit;
    const factor = UNITS[unit].factor;
    const keep = pickKeeper(rows, factor);
    const rate = roundMoney(pickRate(rows, factor));

    const actual = new Map<number, number>();
    const conflicts: string[] = [];
    // Keeper first so its price wins a same-size clash.
    [keep, ...rows.filter(r => r.id !== keep.id)].forEach(r => {
      const legacy = legacySize(r);
      const priced: [number, number][] = legacy
        ? [[legacy, Number(r.price)]]
        : sizesOf(r).map(s => [s, packPrice(r.rate, s, unit, r.pack_prices)]);
      priced.forEach(([size, price]) => {
        const seen = actual.get(size);
        if (seen === undefined) actual.set(size, price);
        else if (seen !== price) conflicts.push(`${formatSize(size, unit)}: ₹${seen} kept, ₹${price} dropped`);
      });
    });

    const ownSizes = cleanSizes(Array.from(actual.keys()));
    const shopSizes = defaults[unit];
    const coveredByDefaults = ownSizes.every(s => shopSizes.includes(s));
    const pack_sizes = coveredByDefaults ? null : cleanSizes([...shopSizes, ...ownSizes]);

    const overrides: Record<string, number> = {};
    actual.forEach((price, size) => {
      if (packPrice(rate, size, unit) !== price) overrides[String(size)] = price;
    });
    const pack_prices = Object.keys(overrides).length ? overrides : null;

    const shown = pack_sizes ?? cleanSizes(shopSizes);
    const preview = cleanSizes([...shown, ...ownSizes]).map(size => ({
      size,
      label: formatSize(size, unit),
      oldPrice: actual.get(size) ?? null,
      newPrice: packPrice(rate, size, unit, pack_prices),
    }));

    plans.push({
      key,
      keepId: keep.id,
      removeIds: rows.filter(r => r.id !== keep.id).map(r => r.id),
      sourceNames: rows.map(r => r.name),
      update: {
        name: baseName(keep.name),
        unit,
        rate,
        pack_sizes,
        pack_prices,
        is_active: rows.some(r => r.is_active),
        category: rows.find(r => r.category)?.category ?? null,
        weight: factor,
        weight_unit: unit === 'ltr' ? 'ltr' : 'gm',
        price: rate,
      },
      preview,
      conflicts,
    });
  });
  return plans.sort((a, b) => a.update.name.localeCompare(b.update.name));
}

// Maps removed item ids to the kept id, for rewriting old order lines.
export const remapIds = (plans: MergeGroup[]) =>
  new Map(plans.flatMap(p => p.removeIds.map(id => [id, p.keepId] as [string, string])));

export function remapLines<T extends { item_id: string }>(lines: T[], map: Map<string, string>): T[] | null {
  let changed = false;
  const next = lines.map(l => {
    const to = map.get(l.item_id);
    if (!to) return l;
    changed = true;
    return { ...l, item_id: to };
  });
  return changed ? next : null;
}
