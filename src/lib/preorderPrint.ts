import type { SeasonalPreorder } from '../hooks/useSeasonalPreorders';
import { nameKey, baseName } from './itemCatalog';
import { PriceUnit, formatSize, formatLineSize, unitFromLine } from './units';
import { balanceOf, fulfillmentOf, isOpenPreorder, isPacked, DateSpan } from './preorders';
import { dayName } from './occasions';
import { esc, money } from './docs/theme';
import { fileSafe, Doc } from './docs/quotationDoc';

// The paper pre-booking register: what to make and pack, then numbered bookings by day with the money to collect.
export interface PrintItem { name: string; size: string; qty: number }
export interface PrintRow { n: number; p: SeasonalPreorder; items: PrintItem[]; packs: number; due: number }
export interface PrintDay { day: string; rows: PrintRow[]; count: number; packs: number; due: number }
export interface PackLine { name: string; total: string; packs: string; boxes: number[] }
export interface PrintPlan { days: PrintDay[]; pack: PackLine[]; count: number; packs: number; advance: number; due: number; deliveries: number }

const isLive = (p: SeasonalPreorder) => p.status !== 'cancelled';
const sumOf = <T,>(list: T[], pick: (x: T) => number) => list.reduce((s, x) => s + pick(x), 0);

export function buildPlan(preorders: SeasonalPreorder[]): PrintPlan {
  const sorted = [...preorders].sort((a, b) => (a.delivery_date || '9').localeCompare(b.delivery_date || '9')
    || a.customer_name.localeCompare(b.customer_name, 'en', { sensitivity: 'base' }));
  const rows: PrintRow[] = sorted.map((p, i) => ({
    n: i + 1, p,
    items: p.items.map(l => ({ name: baseName(l.item_name), size: formatLineSize(l.weight, l.weight_unit), qty: l.qty })),
    packs: isLive(p) ? sumOf(p.items, l => l.qty) : 0,
    due: isLive(p) ? balanceOf(p) : 0,
  }));
  const days: PrintDay[] = [];
  rows.forEach(r => {
    const day = r.p.delivery_date ?? '';
    const last = days[days.length - 1];
    if (last && last.day === day) last.rows.push(r); else days.push({ day, rows: [r], count: 0, packs: 0, due: 0 });
  });
  days.forEach(d => { const live = d.rows.filter(r => isLive(r.p)); d.count = live.length; d.packs = sumOf(live, r => r.packs); d.due = sumOf(live, r => r.due); });
  const live = rows.filter(r => isLive(r.p));
  return {
    days, pack: packLines(rows.filter(r => isOpenPreorder(r.p) && !isPacked(r.p))),
    count: live.length, packs: sumOf(live, r => r.packs), advance: sumOf(live, r => r.p.advance_paid), due: sumOf(live, r => r.due),
    deliveries: live.filter(r => fulfillmentOf(r.p) === 'delivery').length,
  };
}

// Each sweet: packs by size (biggest first), total weight and the box numbers that get it.
export function packLines(rows: PrintRow[]): PackLine[] {
  const by = new Map<string, { name: string; unit: PriceUnit; amount: number; sizes: Map<number, number>; boxes: Set<number> }>();
  rows.forEach(r => r.p.items.forEach(l => {
    const unit = unitFromLine(l.weight_unit);
    const key = `${nameKey(l.item_name)}|${unit}`;
    const s = by.get(key) ?? { name: baseName(l.item_name), unit, amount: 0, sizes: new Map(), boxes: new Set() };
    s.amount += l.weight * l.qty;
    s.sizes.set(l.weight, (s.sizes.get(l.weight) ?? 0) + l.qty);
    s.boxes.add(r.n);
    by.set(key, s);
  }));
  return Array.from(by.values()).sort((a, b) => a.name.localeCompare(b.name)).map(s => ({
    name: s.name, total: formatSize(s.amount, s.unit), boxes: Array.from(s.boxes),
    packs: Array.from(s.sizes).sort((a, b) => b[0] - a[0]).map(([w, q]) => `${q} × ${formatSize(w, s.unit)}`).join(' + '),
  }));
}

export const titleCase = (s: string) => s.replace(/(^|[\s.(-])(\p{Ll})/gu, (_, a: string, c: string) => a + c.toUpperCase());
export const phoneText = (p?: string) => { const d = (p ?? '').replace(/\D/g, '').slice(-10); return d.length === 10 ? `${d.slice(0, 5)} ${d.slice(5)}` : p || 'No phone'; };
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;
const shortDay = (day: string) => (day ? dayName(day).replace(/ \S+$/, '') : '—');

// "Tue 3 – Thu 5 Nov", "Sat 31 Oct – Tue 3 Nov" or one day.
export function datesSpan(days: string[]): string {
  const set = days.filter(Boolean);
  if (!set.length) return 'no dates';
  const [a, b] = [dayName(set[0]), dayName(set[set.length - 1])];
  if (a === b) return a;
  return a.split(' ')[2] === b.split(' ')[2] ? `${a.replace(/ \S+$/, '')} – ${b}` : `${a} – ${b}`;
}

export interface PrintInfo { scope: string; occasion?: string; printedAt: string }

// "Thu 5 Nov", "Tue 3 – Thu 5 Nov", "from …", "until …", or '' for all dates.
export const spanLabel = (s: DateSpan) =>
  !s.from && !s.to ? '' : s.from && s.to ? datesSpan([s.from, s.to]) : s.from ? `from ${dayName(s.from)}` : `until ${dayName(s.to)}`;

// "Sat 31 Oct, 6:24 pm" in IST.
export const printedNow = (now = new Date()) =>
  `${dayName(now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }))}, ${now.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })}`;

const BLANK_ROWS = 2;
const COLS = '<colgroup><col style="width:38px"><col style="width:58px"><col style="width:230px"><col><col style="width:64px"><col style="width:116px"><col style="width:100px"><col style="width:52px"></colgroup>';
const box = '<span class="box"></span>';
const line = '<span class="ln"></span>';
const tag = (t: string, solid = false) => `<b class="tag${solid ? ' on' : ''}">${t}</b>`;

function rowHtml({ n, p, items, due }: PrintRow): string {
  const live = isLive(p);
  const given = p.status === 'delivered';
  const paid = p.advance_paid;
  const addr = fulfillmentOf(p) === 'delivery' ? `<div class="sm">${tag('DELIVERY')} ${esc(p.address ?? '')}</div>` : '';
  const note = p.notes?.trim() ? `<div class="note"><b>Note:</b> ${esc(p.notes.trim())}</div>` : '';
  const sweets = `<div class="its">${items.map(i => `<span><span>${esc(i.name)}</span><span class="q">${esc(i.size)} × <b>${i.qty}</b></span></span>`).join('')}</div>${note}`;
  const collect = !live ? '<b>Cancelled</b>'
    : `<b class="amt">${due > 0 ? money(due) : 'Paid'}</b>${paid > 0 ? `<div class="sm mut">${money(paid)} ${given ? 'paid' : 'advance'}</div>` : ''}`;
  return `<tr class="${n % 2 ? '' : 'z'}${live ? '' : ' x'}"><td class="c n">${n}</td><td>${esc(shortDay(p.delivery_date ?? ''))}</td>
<td><b class="nm">${esc(titleCase(p.customer_name))}</b>&nbsp; <span class="mut">${esc(phoneText(p.phone))}</span>${addr}</td><td>${sweets}</td>
<td class="c">${live ? (isPacked(p) ? tag('Packed', true) : box) : ''}</td><td class="r">${collect}</td>
<td>${live && due > 0 ? line : '<span class="mut">—</span>'}</td><td class="c">${live ? (given ? tag('Given', true) : box) : ''}</td></tr>`;
}

const sumRow = (label: string, due: number, cls: string) =>
  `<tr class="${cls}"><td colspan="5">${label}</td><td class="r"><b>${money(due)}</b></td><td>${line}</td><td></td></tr>`;

// A CSS string; "<" escaped so a search term can't close the <style> tag.
const cssText = (s: string) => `"${s.replace(/["\\]/g, '\\$&').replace(/</g, '\\3C ')}"`;

// Running title and print time sit in the page margins from page 2 on.
const css = (run: string, printed: string) => `
@page { size: A4 landscape; margin: 11mm 10mm 12mm;
  @top-left { content: ${cssText(run)}; font: 600 10pt Inter, Arial, sans-serif; color: #1A1A18; }
  @top-right { content: ${cssText(printed)}; font: 9pt Inter, Arial, sans-serif; color: #4A4A45; }
  @bottom-left { content: "Write each box's # on it. Tick Packed when it is ready. At hand-over write what you received, cash or UPI, and tick Given. Enter changes in the app after the rush."; font: 9pt Inter, Arial, sans-serif; color: #4A4A45; }
  @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 700 9.5pt Inter, Arial, sans-serif; color: #1A1A18; } }
@page :first { margin-top: 8mm; @top-left { content: none; } @top-right { content: none; } }
* { box-sizing: border-box; margin: 0; }
body { font: 13px/1.35 Inter, 'Noto Sans', Arial, sans-serif; color: #1A1A18; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
@media screen { body { max-width: 277mm; margin: 0 auto; padding: 16px; } }
.hd { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; border-bottom: 3px solid #1A1A18; padding-bottom: 7px; margin-bottom: 10px; }
h1 { font-size: 22px; line-height: 1.15; } .hd p { font-size: 14px; margin-top: 2px; } .hd .r { text-align: right; } .hd .r b { font-size: 15px; }
.ph { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 5px; } .ph b { font-size: 14px; } .ph span { font-size: 12px; color: #4A4A45; }
.pk { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 1px; background: #A3A19A; border: 1px solid #1A1A18; border-radius: 4px; overflow: hidden; margin-bottom: 10px; break-inside: avoid; }
.pk div { background: #fff; padding: 5px 9px; font-size: 12.5px; } .pk p { display: flex; justify-content: space-between; gap: 8px; font-size: 13.5px; font-weight: 700; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; border: 1px solid #1A1A18; }
thead th { background: #F2F1EC; font-size: 12.5px; text-align: left; padding: 6px 8px; border-bottom: 1.5px solid #1A1A18; }
td { padding: 5px 8px; vertical-align: top; border-top: 1px solid #A3A19A; }
tr { break-inside: avoid; } tr.z td { background: #F6F5F1; }
.c { text-align: center; padding-left: 2px; padding-right: 2px; } .r { text-align: right; } .n { font-weight: 700; font-size: 14px; }
.nm { font-size: 13.5px; } .mut { color: #4A4A45; } .sm { font-size: 12px; margin-top: 2px; } .amt { font-size: 14px; }
.its { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 16px; row-gap: 2px; }
.its > span { display: flex; justify-content: space-between; gap: 6px; } .q { white-space: nowrap; }
.note { margin-top: 3px; font-size: 12.5px; }
.box { display: inline-block; vertical-align: top; width: 17px; height: 17px; border: 1.5px solid #1A1A18; border-radius: 3px; background: #fff; }
.ln { display: block; height: 18px; border-bottom: 1px solid #1A1A18; }
.tag { display: inline-block; vertical-align: top; font-size: 11.5px; border: 1.5px solid #1A1A18; border-radius: 3px; padding: 0 4px; }
.tag.on { background: #1A1A18; color: #fff; }
tr.x td { color: #6B6B66; } tr.x .its, tr.x .nm { text-decoration: line-through; }
tr.sub td { background: #F2F1EC; border-top: 1px solid #1A1A18; font-size: 12.5px; padding-top: 4px; padding-bottom: 4px; }
tr.blank td { border-top: 1px dashed #A3A19A; height: 32px; color: #6B6B66; font-size: 12px; }
tr.tot td { border-top: 1.5px solid #1A1A18; font-weight: 700; padding-top: 7px; padding-bottom: 7px; }
`;

// Landscape A4: the header row repeats on every page; Chrome adds the running title and page numbers.
export function registerHtml(plan: PrintPlan, info: PrintInfo): string {
  const days = plan.days.map(d => d.day);
  const span = datesSpan(days);
  const where = plan.deliveries ? `${plan.deliveries} home ${plan.deliveries === 1 ? 'delivery' : 'deliveries'}` : 'all pickup';
  const sub = [info.occasion, info.scope, span, where].filter(Boolean).join(' · ');
  const title = 'Pre-bookings to pack and hand over';
  const last = plan.days.reduce((n, d) => n + d.rows.length, 0);
  const pack = plan.pack.length ? `<div class="ph"><b>To make and pack</b><span>${esc(plan.days.length > 1 ? `All ${plan.days.length} days` : span)} · packs × size · which boxes (#) get it · boxes already packed are left out</span></div>
<div class="pk">${plan.pack.map(s => `<div><p><span>${esc(s.name)}</span><span>${esc(s.total)}</span></p>${s.packs.split(' + ').map(x => `<span class="q">${esc(x)}</span>`).join(' + ')}<br><span class="mut">boxes ${s.boxes.join(', ')}</span></div>`).join('')}${'<div></div>'.repeat((5 - (plan.pack.length % 5)) % 5)}</div>` : '';
  const body = plan.days.map(d => d.rows.map(rowHtml).join('')
    + (d.rows.length > 1 ? sumRow(`<b>${esc(d.day ? dayName(d.day) : 'No date')}</b> · ${plural(d.count, 'booking')} · ${plural(d.packs, 'pack')}`, d.due, 'sub') : '')).join('');
  const blanks = Array.from({ length: BLANK_ROWS }, (_, i) => `<tr class="blank"><td class="c">${last + i + 1}</td><td></td><td>${i ? '' : 'Walk-in or change: write it here'}</td><td></td><td class="c">${box}</td><td></td><td>${line}</td><td class="c">${box}</td></tr>`).join('');
  const totLabel = `All days · ${plural(plan.count, 'booking')} printed · ${plural(plan.packs, 'pack')}${plan.advance ? ` · advance taken ${money(plan.advance)}` : ''}`;
  const run = [title, info.occasion, info.scope].filter(Boolean).join(' · ');
  const docTitle = ['Pre-bookings', info.occasion, info.printedAt.replace(/,.*$/, '')].filter(Boolean).join(' ');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(docTitle)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<style>${css(run, `Printed ${info.printedAt}`)}</style></head><body>
<header class="hd"><div><h1>${title}</h1><p>${esc(sub)}</p></div>
<div class="r"><b>${plural(plan.count, 'booking')} · ${plural(plan.packs, 'pack')} · To collect ${money(plan.due)}</b><br>Advance taken ${money(plan.advance)} · Printed ${esc(info.printedAt)}</div></header>
${pack}<table>${COLS}<thead><tr><th class="c">#</th><th>Day</th><th>Customer</th><th>Sweets</th><th class="c">Packed</th><th class="r">To collect</th><th>Received ₹</th><th class="c">Given</th></tr></thead>
<tbody>${body}${blanks}${sumRow(totLabel, plan.due, 'tot')}</tbody></table></body></html>`;
}

// The register as a PDF file; it prints its own page numbers, so the PDF service adds no footer.
export const registerDoc = (plan: PrintPlan, info: PrintInfo, dates = ''): Doc => ({
  html: registerHtml(plan, info),
  fileName: `${fileSafe(['Pre-bookings', info.occasion, dates || info.printedAt.replace(/,.*$/, '')].filter(Boolean).join(' '))}.pdf`,
  footer: '',
});
