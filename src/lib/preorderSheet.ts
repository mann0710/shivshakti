import type { SeasonalPreorder } from '../hooks/useSeasonalPreorders';
import type { SeasonalItem } from './itemCatalog';
import { nameKey, baseName } from './itemCatalog';
import { PriceUnit, formatSize, formatLineSize, unitFromLine, rateLabel } from './units';
import { formatDay } from './sessionalReceipts';
import { FULFILLMENT_LABEL, balanceOf, fulfillmentOf } from './preorders';

// The on-screen pre-booking register: one row per customer, one column per sweet.
export interface SheetColumn { key: string; name: string; unit: PriceUnit; rate: string; amount: number; packs: number }
export interface SheetRow { p: SeasonalPreorder; cells: Record<string, string> }
export interface Sheet { columns: SheetColumn[]; rows: SheetRow[]; total: number; paid: number; balance: number }

const colKey = (name: string, unit: PriceUnit) => `${nameKey(name)}|${unit}`;

export function buildSheet(preorders: SeasonalPreorder[], items: SeasonalItem[]): Sheet {
  const byId = new Map(items.map(i => [i.id, i]));
  const cols = new Map<string, SheetColumn>();
  const rows = [...preorders]
    .sort((a, b) => (a.delivery_date || '9').localeCompare(b.delivery_date || '9') || a.customer_name.localeCompare(b.customer_name))
    .map(p => {
      const parts = new Map<string, string[]>();
      p.items.forEach(l => {
        const unit = unitFromLine(l.weight_unit);
        const key = colKey(l.item_name, unit);
        const item = byId.get(l.item_id);
        const col = cols.get(key) ?? { key, name: baseName(l.item_name), unit, rate: item?.rate ? rateLabel(item.rate, item.unit) : '', amount: 0, packs: 0 };
        if (p.status !== 'cancelled') { col.amount += l.weight * l.qty; col.packs += l.qty; }
        cols.set(key, col);
        parts.set(key, [...(parts.get(key) ?? []), `${formatLineSize(l.weight, l.weight_unit)} × ${l.qty}`]);
      });
      return { p, cells: Object.fromEntries(Array.from(parts, ([k, v]) => [k, v.join(', ')])) };
    });
  const live = preorders.filter(p => p.status !== 'cancelled');
  return {
    columns: Array.from(cols.values()).sort((a, b) => a.name.localeCompare(b.name)),
    rows,
    total: live.reduce((s, p) => s + p.total_amount, 0),
    paid: live.reduce((s, p) => s + p.advance_paid, 0),
    balance: live.reduce((s, p) => s + balanceOf(p), 0),
  };
}

export const columnTotal = (c: SheetColumn) => `${formatSize(c.amount, c.unit)} (${c.packs})`;
export const dueLabel = (p: SeasonalPreorder) =>
  `${p.delivery_date ? formatDay(p.delivery_date) : 'No date'} · ${FULFILLMENT_LABEL[fulfillmentOf(p)]}`;
