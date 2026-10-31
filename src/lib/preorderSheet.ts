import type { SeasonalPreorder } from '../hooks/useSeasonalPreorders';
import type { SeasonalItem } from './itemCatalog';
import { nameKey, baseName } from './itemCatalog';
import { PriceUnit, formatSize, formatLineSize, unitFromLine, rateLabel } from './units';
import { formatDay } from './sessionalReceipts';
import { FULFILLMENT_LABEL, STATUS_LABEL, balanceOf, fulfillmentOf, isPacked } from './preorders';
import { esc, page, money } from './docs/theme';
import { slimHeader } from './docs/parts';
import { DocContext, docContext } from './docs/context';

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
export function sheetHtml(sheet: Sheet, title: string, ctx: DocContext = docContext()): string {
  const tick = (on: boolean) => `<span class="tick">${on ? '✓' : ''}</span>`;
  const head = sheet.columns.map(c => `<th>${esc(c.name)}<small>${esc(c.rate)}</small></th>`).join('');
  const body = sheet.rows.map(({ p, cells }, i) => `<tr class="${p.status === 'cancelled' ? 'x' : ''}">
    <td class="c">${tick(isPacked(p))}</td><td class="c">${tick(p.status === 'delivered')}</td>
    <td class="muted">${i + 1}</td><td><b>${esc(p.customer_name)}</b><small class="num">${esc(p.phone || '')}</small>${p.address ? `<small>${esc(p.address)}</small>` : ''}</td>
    <td class="num">${esc(dueLabel(p))}<small>${STATUS_LABEL[p.status]}</small></td>
    ${sheet.columns.map(c => `<td class="q">${cells[c.key] ?? ''}</td>`).join('')}
    <td class="r">${money(p.total_amount)}</td><td class="r">${money(p.advance_paid)}</td><td class="r"><b>${p.status === 'cancelled' ? '—' : money(balanceOf(p))}</b></td></tr>`).join('');
  const right = `${sheet.rows.length} bookings · Total ${money(sheet.total)} · Paid ${money(sheet.paid)} · <b>Balance ${money(sheet.balance)}</b><br>Printed ${esc(new Date().toLocaleString('en-IN'))}`;
  return page(title, ctx.settings.accent, `${slimHeader(ctx, 'Pre-booking register', title, right)}
<div class="wrap" style="padding:10px 8mm 0"><div class="box"><table class="t sheet"><thead><tr><th>Packed</th><th>Given</th><th>#</th><th>Customer &amp; contact</th><th>Date</th>${head}<th class="r">Total</th><th class="r">Paid</th><th class="r">Balance</th></tr></thead>
<tbody>${body}</tbody>
<tfoot><tr><td colspan="5">Total quantity</td>${sheet.columns.map(c => `<td class="q">${columnTotal(c)}</td>`).join('')}<td class="r">${money(sheet.total)}</td><td class="r">${money(sheet.paid)}</td><td class="r">${money(sheet.balance)}</td></tr></tfoot>
</table></div></div>`, `
@page { size: A4 landscape; margin: 8mm 0; } @page :first { margin-top: 0; }
@media screen { body { max-width: 297mm; } }
.sheet td, .sheet th { padding: 5px 7px; font-size: 11px; border-right: 1px solid #F0F0F4; }
.sheet small { display: block; color: #5C5C6B; font-size: 10px; font-weight: 400; letter-spacing: 0; text-transform: none; }
.sheet .c { text-align: center; } .sheet .q { white-space: nowrap; color: #1E1B6E; font-weight: 600; }
.sheet tfoot td { background: #FFF3E0; font-weight: 700; color: #6D3A00; }
.sheet tr.x td { color: #9A9AAA; text-decoration: line-through; }
.tick { display: inline-flex; width: 15px; height: 15px; border: 1.5px solid #1C1C24; border-radius: 3px; align-items: center; justify-content: center; font-size: 11px; }`);
}
