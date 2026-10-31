import type { ReceiptData } from './receipt';
import { DocContext, docContext } from './docs/context';
import { page, esc, money, HEAD_FONT } from './docs/theme';
import { formatLineSize } from './units';
import { SHOP } from './shop';
import { WALK_IN } from './posForm';
import { DayClosePayload, NOTES, dayLabel, whenLabel, differenceOf, differenceLabel } from './dayClose';

// 80 mm thermal slips: the counter bill and the day close summary. Black only; empty shop fields are left out.
export interface PayLines { cash: number; upi: number; returned: number; refunded: number }
export interface SweetReceipt extends ReceiptData { pay?: PayLines; cancelled?: string }

const CSS = `
@page { size: auto; margin: 4mm; } @page :first { margin-top: 4mm; }
body { width: 72mm; max-width: 72mm; margin: 0 auto; box-shadow: none; font-size: 12.5px; color: #000; }
.bill { padding: 4px 2px; display: flex; flex-direction: column; gap: 10px; }
.bill header { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 1px; font-size: 11px; }
.wm { font-family: ${HEAD_FONT}; font-size: 22px; letter-spacing: 1px; } .tag { letter-spacing: 2px; }
.row { display: flex; justify-content: space-between; gap: 8px; } .rt { text-align: right; }
.dash { border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 7px 0; } .no { font-size: 14px; }
.occ, .void { text-align: center; font-weight: 600; } .void { border: 2px solid #000; padding: 4px; letter-spacing: 1px; }
.lines { display: flex; flex-direction: column; gap: 7px; }
.totals { border-top: 1px dashed #000; padding-top: 7px; display: flex; flex-direction: column; gap: 3px; }
.tot { border-top: 2px solid #000; margin-top: 4px; padding-top: 6px; align-items: baseline; } .t { font-family: ${HEAD_FONT}; font-size: 22px; }
.h { font-weight: 700; letter-spacing: 1px; margin-top: 4px; } .note, .small { font-size: 11.5px; }
.bill footer { border-top: 1px dashed #000; padding-top: 8px; display: flex; flex-direction: column; align-items: center; gap: 2px; font-size: 11px; text-align: center; }`;

const opt = (v?: string | null, cls = '') => (v?.trim() ? `<span${cls ? ` class="${cls}"` : ''}>${esc(v.trim())}</span>` : '');
// Label is text; value is trusted HTML (money).
const row = (label: string, value = '', cls = '') => `<div class="row${cls ? ` ${cls}` : ''}"><span>${esc(label)}</span><span>${value}</span></div>`;
const bold = (label: string, value: string) => `<div class="row"><b>${esc(label)}</b><b>${value}</b></div>`;

const head = (ctx: DocContext, gst?: string) =>
  `<header><b class="wm">SHIV SHAKTI</b><span class="tag">SWEETS · CATERING</span>${opt(ctx.settings.address)}${opt(SHOP.phone, 'num')}${gst ? opt(`GSTIN ${gst}`, 'num') : ''}</header>`;

const foot = (...lines: (string | undefined)[]) => {
  const shown = lines.filter(l => l?.trim()) as string[];
  return shown.length ? `<footer>${shown.map((l, i) => (i ? `<span>${esc(l)}</span>` : `<b>${esc(l)}</b>`)).join('')}</footer>` : '';
};

const slip = (title: string, ctx: DocContext, inner: string) => page(title, ctx.settings.accent, `<div class="bill">${inner}</div>`, CSS);

function payRows(r: SweetReceipt): string {
  const p = r.pay;
  const paid = p && (p.cash || p.upi || p.refunded);
  const lines = paid ? [
    p.cash > 0 ? row('Cash', money(p.cash)) : '',
    p.upi > 0 ? row('UPI', money(p.upi)) : '',
    p.returned > 0 ? row('Returned', money(p.returned)) : '',
    p.refunded > 0 ? row('Refunded', money(p.refunded)) : '',
  ].join('') : row(r.status);
  return `${lines}${(r.balance ?? 0) > 0 ? bold('Balance due', money(r.balance ?? 0)) : ''}`;
}

export function posBillHtml(r: SweetReceipt, ctx: DocContext = docContext()): string {
  const packs = r.lines.reduce((s, l) => s + l.qty, 0);
  const who = [r.customer_name === WALK_IN ? '' : r.customer_name, r.phone].filter(Boolean).map(v => `<br>${esc(v)}`).join('');
  const inner = `${head(ctx, r.gst_number)}
  <div class="row dash num"><span><b class="no">${esc(r.kind)} #${esc(r.number)}</b>${who}</span><span class="rt">${esc(r.date)}${r.time ? `<br>${esc(r.time)}` : ''}</span></div>
  ${r.cancelled !== undefined ? `<div class="void">CANCELLED${r.cancelled ? ` · ${esc(r.cancelled)}` : ''}</div>` : ''}
  ${r.occasion ? `<div class="occ">${esc(r.occasion)}</div>` : ''}
  <div class="lines">${r.lines.map(l => `<div class="ln num"><b>${esc(l.item_name)}</b> · ${formatLineSize(l.weight, l.weight_unit)}<div class="row"><span>${l.qty} × ${money(l.price)}</span><b>${money(l.line_total)}</b></div></div>`).join('')}</div>
  <div class="totals num">
    ${row(`Subtotal · ${packs} pack${packs === 1 ? '' : 's'}`, money(r.subtotal))}
    ${r.discount > 0 ? row('Discount', `− ${money(r.discount)}`) : ''}
    <div class="row tot"><b>TOTAL</b><b class="t">${money(r.total)}</b></div>
    ${payRows(r)}
  </div>
  ${r.notes ? `<div class="note">${esc(r.notes)}</div>` : ''}
  ${foot(ctx.settings.bill_footer, SHOP.phone ? `Pre-book festival sweets: ${SHOP.phone}` : '')}`;
  return slip(`${r.kind} ${r.number}`, ctx, inner);
}

// Drawer count, money by source and UPI to check, for the counter file.
export function dayCloseSlipHtml(c: DayClosePayload, ctx: DocContext = docContext()): string {
  const diff = differenceOf(c);
  const counted = NOTES.filter(n => c.note_counts[n]).map(n => row(`₹${n} × ${c.note_counts[n]}`, money(Number(n) * (c.note_counts[n] ?? 0)), 'small')).join('')
    + (c.note_counts.coins ? row('Coins', money(c.note_counts.coins), 'small') : '');
  const inner = `${head(ctx)}
  <div class="row dash num"><span><b class="no">Day close</b><br>${esc(dayLabel(c.day))}</span><span class="rt">${c.from_at ? `From ${esc(whenLabel(c.from_at))}<br>` : ''}To ${esc(whenLabel(c.closed_at))}</span></div>
  <div class="totals num" style="border-top:0;padding-top:0">
    ${row(`Bills · ${c.bills_count}`, money(c.sales_total))}
    ${c.unpaid_total > 0 ? row('Left unpaid', money(c.unpaid_total)) : ''}
    <div class="h">CASH</div>
    ${row('Opening cash', money(c.opening_cash))}
    ${row('+ Cash from bills', money(c.cash_bills))}
    ${c.cash_advances ? row('+ Pre-booking advances', money(c.cash_advances)) : ''}
    ${c.cash_handover ? row('+ Hand-over balances', money(c.cash_handover)) : ''}
    ${c.cash_dues ? row('+ Old dues collected', money(c.cash_dues)) : ''}
    ${c.cash_out ? row(`− Taken out${c.cash_out_note ? ` (${c.cash_out_note})` : ''}`, money(c.cash_out)) : ''}
    <div class="row tot"><b>Should be in drawer</b><b>${money(c.expected_cash)}</b></div>
    ${counted}
    ${bold('Counted', money(c.counted_cash))}
    ${bold(differenceLabel(diff), money(Math.abs(diff)))}
    ${row('Keep for tomorrow', money(c.keep_cash))}
    ${row('Take out now', money(Math.max(0, c.counted_cash - c.keep_cash)))}
    <div class="h">UPI</div>
    ${bold('UPI received', money(c.upi_total))}
    <div class="small">Check this against your UPI app.</div>
  </div>
  ${c.note ? `<div class="note">${esc(c.note)}</div>` : ''}
  ${foot(`Printed ${whenLabel(new Date().toISOString())}`)}`;
  return slip(`Day close ${c.day}`, ctx, inner);
}
