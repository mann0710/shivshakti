import type { SeasonalOrderItem } from '../hooks/useSeasonalOrders';
import { SeasonalItem, baseName } from './itemCatalog';
import { UNITS, roundMoney, unitFromLine, formatLineSize } from './units';

export type CartLine = SeasonalOrderItem;

export const lineKey = (l: Pick<CartLine, 'item_id' | 'weight' | 'price'>) => `${l.item_id}:${l.weight}:${l.price}`;

export const makeLine = (item: SeasonalItem, size: number, price: number, qty = 1): CartLine => ({
  item_id: item.id,
  item_name: item.name,
  weight: size,
  weight_unit: UNITS[item.unit].lineUnit,
  price,
  qty,
  line_total: roundMoney(price * qty),
});

// Same pack again bumps its quantity instead of adding a second row.
export function addLine(lines: CartLine[], line: CartLine): CartLine[] {
  const key = lineKey(line);
  const at = lines.findIndex(l => lineKey(l) === key);
  if (at < 0) return [...lines, line];
  return lines.map((l, i) => (i === at ? withQty(l, l.qty + line.qty) : l));
}

export const withQty = (l: CartLine, qty: number): CartLine => ({ ...l, qty, line_total: roundMoney(l.price * qty) });

export const setLineQty = (lines: CartLine[], key: string, qty: number) =>
  qty <= 0 ? lines.filter(l => lineKey(l) !== key) : lines.map(l => (lineKey(l) === key ? withQty(l, qty) : l));

export const subtotalOf = (lines: CartLine[]) => roundMoney(lines.reduce((s, l) => s + l.line_total, 0));

export const packsByItem = (lines: CartLine[]) => {
  const m = new Map<string, number>();
  lines.forEach(l => m.set(l.item_id, (m.get(l.item_id) ?? 0) + l.qty));
  return m;
};

export const lineLabel = (l: CartLine) => `${l.item_name} · ${formatLineSize(l.weight, l.weight_unit)}`;

// Total quantity per item across bills, e.g. for item sales and kitchen prep lists.
export interface ItemTotal { key: string; name: string; unit: ReturnType<typeof unitFromLine>; amount: number; packs: number; revenue: number }

export function totalsByItem(lines: CartLine[], keyOf: (l: CartLine) => string): ItemTotal[] {
  const m = new Map<string, ItemTotal>();
  lines.forEach(l => {
    const unit = unitFromLine(l.weight_unit);
    const key = `${keyOf(l)}|${unit}`;
    const cur = m.get(key) ?? { key, name: baseName(l.item_name), unit, amount: 0, packs: 0, revenue: 0 };
    cur.amount += l.weight * l.qty;
    cur.packs += l.qty;
    cur.revenue = roundMoney(cur.revenue + l.line_total);
    m.set(key, cur);
  });
  return Array.from(m.values()).sort((a, b) => a.name.localeCompare(b.name));
}
