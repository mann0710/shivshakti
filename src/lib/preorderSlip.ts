import { ReceiptData, esc } from './receipt';
import { formatLineSize, formatSize, unitFromLine } from './units';
import { inr } from './money';
import { SHOP } from './shop';

// A4 pre-booking slip: customer, hand-over, items, every payment and signatures.
export function preorderSlipHtml(r: ReceiptData): string {
  const b = r.booking!;
  const items = r.lines.map((l, i) => `<tr>
    <td>${i + 1}</td><td>${esc(l.item_name)}</td><td>${formatLineSize(l.weight, l.weight_unit)}</td>
    <td class="r">${l.qty}</td><td>${formatSize(l.weight * l.qty, unitFromLine(l.weight_unit))}</td>
    <td class="r">${inr(l.price)}</td><td class="r">${inr(l.line_total)}</td></tr>`).join('');
  const packs = r.lines.reduce((s, l) => s + l.qty, 0);
  const pay = (label: string, value: string, cls = '') => `<tr class="${cls}"><td>${label}</td><td class="r">${value}</td></tr>`;
  const field = (label: string, value?: string) => (value ? `<div class="f"><span>${label}</span><b>${esc(value)}</b></div>` : '');

  return `<!doctype html><html><head><meta charset="utf-8"><title>Pre-booking ${esc(r.number)} - ${esc(r.customer_name)}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; } body { font: 12.5px/1.45 Arial, 'Noto Sans Gujarati', sans-serif; color: #111; margin: 0; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1A237E; padding-bottom: 8px; }
  h1 { margin: 0; font-size: 24px; color: #1A237E; } .muted { color: #555; font-size: 11.5px; }
  .doc { text-align: right; } .doc .t { font-size: 16px; font-weight: 700; letter-spacing: .5px; } .doc .n { font-size: 20px; font-weight: 800; }
  .boxes { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 12px 0; }
  .box { border: 1px solid #C9CBE0; border-radius: 6px; padding: 8px 10px; } .box h3 { margin: 0 0 4px; font-size: 11px; color: #1A237E; text-transform: uppercase; letter-spacing: .6px; }
  .f { display: flex; gap: 8px; padding: 1px 0; } .f span { width: 82px; color: #555; flex-shrink: 0; }
  .due { font-size: 15px; color: #B23A00; }
  table { width: 100%; border-collapse: collapse; } th { background: #1A237E; color: #fff; text-align: left; font-size: 11.5px; padding: 6px; }
  .items td { border-bottom: 1px solid #DDD; padding: 6px; } .items tr:nth-child(even) td { background: #F7F7FB; } .r { text-align: right; white-space: nowrap; }
  .sum { display: flex; justify-content: space-between; gap: 16px; margin-top: 12px; align-items: flex-start; }
  .note { flex: 1; border: 1px dashed #AAA; border-radius: 6px; padding: 8px 10px; min-height: 60px; }
  .pay { width: 300px; border: 1px solid #C9CBE0; border-radius: 6px; overflow: hidden; } .pay td { padding: 5px 10px; border-bottom: 1px solid #EEE; }
  .pay .tot td { font-weight: 800; font-size: 14px; background: #EEF0FB; } .pay .bal td { font-weight: 800; font-size: 15px; color: #B23A00; background: #FFF4EC; }
  .sign { display: flex; justify-content: space-between; margin-top: 46px; } .sign div { width: 40%; border-top: 1px solid #333; text-align: center; padding-top: 4px; font-size: 11.5px; }
  .foot { margin-top: 18px; text-align: center; font-size: 11px; color: #555; }
</style></head><body>
<div class="top">
  <div><h1>${esc(SHOP.name)}</h1><div class="muted">${esc(SHOP.tagline)} · Ph: ${SHOP.phone} · ${esc(SHOP.email)}${r.gst_number ? `<br>GSTIN: ${esc(r.gst_number)}` : ''}</div></div>
  <div class="doc"><div class="t">PRE-BOOKING ORDER</div><div class="n">#${esc(r.number)}</div><div class="muted">Booked on ${esc(r.date)}</div></div>
</div>
<div class="boxes">
  <div class="box"><h3>Customer</h3>
    ${field('Name', r.customer_name)}${field('Mobile', r.phone)}${field('Address', b.address)}${field('Occasion', r.occasion)}
  </div>
  <div class="box"><h3>Hand-over</h3>
    ${field('Type', b.handover)}
    ${r.delivery_date ? `<div class="f"><span>Date</span><b class="due">${esc(r.delivery_date)}</b></div>` : ''}
    ${field('Status', b.status)}${field('Handed over', b.handed_over)}
  </div>
</div>
<table class="items">
  <tr><th>#</th><th>Item</th><th>Pack</th><th class="r">Qty</th><th>Total qty</th><th class="r">Rate</th><th class="r">Amount</th></tr>
  ${items}
</table>
<div class="sum">
  <div class="note"><b>Note:</b> ${r.notes ? esc(r.notes) : ''}<div class="muted" style="margin-top:6px">${r.lines.length} item${r.lines.length === 1 ? '' : 's'} · ${packs} pack${packs === 1 ? '' : 's'}</div></div>
  <table class="pay">
    ${pay('Subtotal', inr(r.subtotal))}
    ${r.discount > 0 ? pay('Discount', `- ${inr(r.discount)}`) : ''}
    ${pay('Total', inr(r.total), 'tot')}
    ${pay(`Advance paid${b.advance > 0 ? ` (${esc(b.advance_mode)})` : ''}`, inr(b.advance))}
    ${b.collected > 0 ? pay(`Paid at hand-over (${esc(b.collected_mode)})`, inr(b.collected)) : ''}
    ${pay('Balance due', inr(r.balance ?? 0), 'bal')}
  </table>
</div>
<div class="sign"><div>Customer signature</div><div>For ${esc(SHOP.name)}</div></div>
<div class="foot">Please bring this slip when you collect your order. Thank you!</div>
</body></html>`;
}
