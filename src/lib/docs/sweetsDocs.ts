// Pre-booking A4 slip; the 80 mm counter bill lives in ../thermalSlips (posBillHtml).
import type { ReceiptData } from '../receipt';
import { DocContext, docContext } from './context';
import { page, esc, money, HEAD_FONT } from './theme';
import { header, signatures, sumRows, SumRow } from './parts';
import { formatLineSize, formatSize, unitFromLine } from '../units';

const box = (on: boolean) => `<span class="tick">${on ? '✓' : ''}</span>`;

// A4 pre-booking slip with every payment and a tear-off counter stub.
export function preorderSlipHtml(r: ReceiptData, ctx: DocContext = docContext()): string {
  const b = r.booking!;
  const pickup = b.handover.toLowerCase().includes('pickup');
  const packs = r.lines.reduce((s, l) => s + l.qty, 0);
  const pays: SumRow[] = [
    { label: 'Total', value: r.total, cls: 'tot' },
    ...(b.advance > 0 ? [{ label: `Advance · ${b.advance_mode}`, value: b.advance, sign: '-' as const }] : []),
    ...(b.collected > 0 ? [{ label: `Paid at hand-over · ${b.collected_mode}`, value: b.collected, sign: '-' as const }] : []),
  ];
  const body = `${header(ctx, 'Pre-booking', `#${r.number}`, `Booked ${r.date}${r.occasion ? ` · ${r.occasion}` : ''}`, 'Shiv Shakti Sweets')}
<div class="wrap">
  <div class="intro" style="grid-template-columns:minmax(0,1fr) 250px">
    <div class="fact"><span class="lbl">Customer</span><span class="big">${esc(r.customer_name)}</span>
      ${r.phone ? `<span class="num">+91 ${esc(r.phone)}</span>` : ''}${b.address ? `<span class="muted">${esc(b.address)}</span>` : ''}
      <span class="muted">${pickup ? 'Pickup from the shop' : 'Home delivery'}</span></div>
    <div class="when"><span class="lbl" style="color:#8A4B00">${pickup ? 'Pickup on' : 'Delivery on'}</span>
      <b class="num">${esc(r.delivery_date || 'Date to confirm')}</b><span>Status: ${esc(b.status)}${b.handed_over ? ` · ${esc(b.handed_over)}` : ''}</span></div>
  </div>
  <section><div class="box"><table class="t"><thead><tr><th>Item</th><th>Pack</th><th class="r">Qty</th><th class="r">Total qty</th><th class="r">Price</th><th class="r">Amount</th></tr></thead>
  <tbody>${r.lines.map(l => `<tr><td><b>${esc(l.item_name)}</b></td><td>${formatLineSize(l.weight, l.weight_unit)}</td><td class="r">${l.qty}</td><td class="r muted">${formatSize(l.weight * l.qty, unitFromLine(l.weight_unit))}</td><td class="r">${money(l.price)}</td><td class="r">${money(l.line_total)}</td></tr>`).join('')}</tbody></table></div></section>
  <section class="split">
    <div><span class="lbl">Note</span><div style="margin-top:3px">${r.notes ? esc(r.notes) : 'Please bring this slip at pickup.'}</div><div class="muted" style="margin-top:6px">${r.lines.length} item${r.lines.length === 1 ? '' : 's'} · ${packs} pack${packs === 1 ? '' : 's'}${r.discount > 0 ? ` · discount ${money(r.discount)} applied` : ''}</div></div>
    <div class="sum">${sumRows(pays)}<div class="due"><span>${(r.balance ?? 0) > 0 ? `Balance ${pickup ? 'at pickup' : 'on delivery'}` : 'Fully paid'}</span><b class="num">${money(r.balance ?? 0)}</b></div></div>
  </section>
  <div style="margin-top:40px">${signatures('Customer signature', 'For Shiv Shakti')}</div>
</div>
${ctx.settings.slip_stub ? `<div class="stub"><span class="cut">Cut here — counter stub</span>
  <div class="stub-row"><b class="docno" style="font-size:22px">#${esc(r.number)}</b>
    <div><b>${esc(r.customer_name)}</b><div class="muted num">${esc(r.phone || '')} · ${pickup ? 'Pickup' : 'Delivery'} ${esc(r.delivery_date || '')}</div></div>
    <div class="num"><span class="muted">Balance to collect</span><div style="font-size:18px;font-weight:700">${money(r.balance ?? 0)}</div></div>
    <div class="ticks">${box(b.packed)} Packed<br>${box(b.given)} Given</div></div>
  <div class="muted num" style="font-size:12px">${r.lines.map(l => `${esc(l.item_name)} ${formatLineSize(l.weight, l.weight_unit)} × ${l.qty}`).join(' · ')}</div></div>` : ''}`;
  return page(`Pre-booking ${r.number} - ${r.customer_name}`, ctx.settings.accent, body, `
@page { margin: 10mm 0; } @page :first { margin-top: 0; }
.when { background: #FFF4E5; border: 1px solid #F3C98B; border-radius: 10px; padding: 12px 16px; display: flex; flex-direction: column; gap: 3px; color: #8A4B00; font-size: 12px; }
.when b { font-family: ${HEAD_FONT}; font-size: 22px; }
.stub { margin-top: 34px; border-top: 2px dashed #9A9AAA; padding: 18px 13mm 10px; background: #FAFAFC; position: relative; break-inside: avoid; display: flex; flex-direction: column; gap: 10px; }
.cut { position: absolute; top: -10px; left: 13mm; background: #fff; padding: 0 8px; font-size: 11px; color: #5C5C6B; }
.stub-row { display: grid; grid-template-columns: 120px minmax(0, 1fr) 150px 110px; gap: 16px; align-items: center; }
.ticks { line-height: 1.9; font-size: 13px; }
.tick { display: inline-flex; width: 15px; height: 15px; border: 1.5px solid #1C1C24; border-radius: 3px; align-items: center; justify-content: center; font-size: 11px; vertical-align: -2px; margin-right: 6px; }`);
}
