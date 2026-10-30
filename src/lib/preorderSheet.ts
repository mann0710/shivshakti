import type { SeasonalPreorder } from '../hooks/useSeasonalPreorders';
import type { SeasonalItem } from './itemCatalog';
import { nameKey, baseName } from './itemCatalog';
import { PriceUnit, formatSize, formatLineSize, unitFromLine, rateLabel } from './units';
import { formatDay } from './sessionalReceipts';
import { FULFILLMENT_LABEL, STATUS_LABEL, balanceOf, fulfillmentOf } from './preorders';
import { esc } from './receipt';
import { inr } from './money';
import { SHOP } from './shop';

// The paper pre-booking register: one row per customer, one column per sweet.
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

// Landscape print of the register, with tick boxes for the counter.
export function sheetHtml(sheet: Sheet, title: string): string {
  const head = sheet.columns.map(c => `<th>${esc(c.name)}<small>${esc(c.rate)}</small></th>`).join('');
  const body = sheet.rows.map(({ p, cells }, i) => `<tr class="${p.status === 'cancelled' ? 'x' : ''}">
    <td class="c">${p.status === 'ready' || p.status === 'delivered' ? '☑' : '☐'}</td><td class="c">${p.status === 'delivered' ? '☑' : '☐'}</td>
    <td>${i + 1}</td><td><b>${esc(p.customer_name)}</b><br>${esc(p.phone || '')}${p.address ? `<br><small>${esc(p.address)}</small>` : ''}</td>
    <td>${esc(dueLabel(p))}<br><small>${STATUS_LABEL[p.status]}</small></td>
    ${sheet.columns.map(c => `<td class="q">${cells[c.key] ?? ''}</td>`).join('')}
    <td class="r">${inr(p.total_amount)}</td><td class="r">${inr(p.advance_paid)}</td><td class="r"><b>${p.status === 'cancelled' ? '—' : inr(balanceOf(p))}</b></td></tr>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  @page { size: A4 landscape; margin: 8mm; } body { font: 11px/1.3 Arial, 'Noto Sans Gujarati', sans-serif; margin: 0; }
  h1 { font-size: 16px; margin: 0 0 2px; } .m { color: #555; margin-bottom: 8px; }
  table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid #888; padding: 4px 5px; vertical-align: top; }
  th { background: #E8EAF6; font-size: 10.5px; text-align: left; } th small, td small { display: block; color: #555; font-weight: normal; font-size: 9.5px; }
  .c { text-align: center; font-size: 15px; } .q { white-space: nowrap; } .r { text-align: right; white-space: nowrap; }
  tfoot td { background: #FFF3E0; font-weight: bold; } tr.x td { color: #999; text-decoration: line-through; }
</style></head><body>
<h1>${esc(SHOP.name)} — ${esc(title)}</h1>
<div class="m">${sheet.rows.length} bookings · Total ${inr(sheet.total)} · Paid ${inr(sheet.paid)} · Balance ${inr(sheet.balance)} · Printed ${new Date().toLocaleString('en-IN')}</div>
<table><thead><tr><th>Packed</th><th>Given</th><th>#</th><th>Customer &amp; contact</th><th>Date</th>${head}<th>Total</th><th>Paid</th><th>Balance</th></tr></thead>
<tbody>${body}</tbody>
<tfoot><tr><td colspan="5">Total quantity</td>${sheet.columns.map(c => `<td class="q">${columnTotal(c)}</td>`).join('')}<td class="r">${inr(sheet.total)}</td><td class="r">${inr(sheet.paid)}</td><td class="r">${inr(sheet.balance)}</td></tr></tfoot>
</table></body></html>`;
}
