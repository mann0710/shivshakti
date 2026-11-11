// A4 invoice for a sweets sale (counter bill or pre-booking): items, tax, payments, bank / UPI and terms.
import { BillRow, STAGE_LABEL } from '../billList';
import type { PayKind } from '../payments';
import { DocContext, docContext } from './context';
import { page, esc, money } from './theme';
import { header, facts, sumRows, SumRow, terms, endLine, footerText } from './parts';
import { Doc, fileSafe } from './quotationDoc';
import { qrSvg, upiLink } from './qr';
import { amountInWords, gstInside, taxSplit } from '../gst';
import { formatLineSize } from '../units';
import { formatDateIST } from '../ist';
import { MODE_LABEL } from '../payments';
import { WALK_IN } from '../posForm';

const CSS = `
.void-stamp { border: 2px solid #A32D2D; color: #A32D2D; border-radius: 8px; padding: 8px 12px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 14px; text-align: center; }
.sw-sign { text-align: right; margin-top: 34px; font-size: 12px; } .sw-sign div { height: 30px; border-bottom: 1px solid #1C1C24; margin-bottom: 4px; }
.sw-terms { margin-top: 18px; break-inside: avoid; } .sw-terms ol.terms { font-size: 11.5px; gap: 2px; margin-top: 4px; }`;
const day = (d?: string) => (d ? formatDateIST(d, 'dd MMM yyyy') : '');
const PAY_KIND: Record<PayKind, string> = { sale: 'At the counter', due: 'Due collected', advance: 'Advance', handover: 'At hand-over', refund: 'Refund', writeoff: 'Let go', from_advance: 'From advance' };

// Bank text and UPI ID, with a QR (not on cancelled sales): the balance filled in when something is due, else an open amount.
function payTo(ctx: DocContext, due: number, note: string, cancelled: boolean): string {
  const { bank, upi_id, invoice_qr } = ctx.settings;
  const upi = upi_id.trim();
  if (!bank && !upi) return '';
  const qr = upi && invoice_qr && !cancelled ? qrSvg(upiLink(upi, due, note)) : '';
  const hint = !qr ? '' : due > 0 ? `Scan to pay ${money(due)}` : 'Scan to pay by UPI';
  return `<div class="upi" style="margin-top:14px">${qr}<div style="display:flex;flex-direction:column;gap:3px"><span class="lbl">Bank details</span>
  ${bank ? `<span style="white-space:pre-line">${esc(bank)}</span>` : ''}${upi ? `<span class="num"><b>UPI</b> ${esc(upi)}</span>` : ''}
  ${hint ? `<span class="muted">${hint}</span>` : ''}</div></div>`;
}

export function sweetsInvoiceDoc(r: BillRow, occasion?: string, ctx: DocContext = docContext()): Doc {
  const s = ctx.settings;
  const rate = s.sweets_gst_rate;
  const taxed = !!ctx.gstNumber && rate > 0;
  const tax = gstInside(r.total, taxed ? rate : 0);
  const walkIn = r.name === WALK_IN;
  const ref = `${r.kind === 'bill' ? 'Bill' : 'Pre-booking'} #${r.number}`;
  const totals: SumRow[] = [
    { label: 'Subtotal', value: r.subtotal, cls: '' },
    ...(r.discount > 0 ? [{ label: 'Discount', value: r.discount, sign: '-' as const }] : []),
    ...(taxed ? [{ label: 'Taxable value', value: tax.taxable, cls: 'line' }, ...taxSplit(tax.gst, rate, ctx.gstNumber).map(t => ({ label: `${t.label} (included)`, value: t.amount }))] : []),
    { label: 'Invoice total', value: r.total, cls: 'tot' },
    ...(r.paid > 0 ? [{ label: 'Paid', value: r.paid, sign: '-' as const }] : []),
  ];
  const paid = r.payments.length
    ? `<div style="margin-top:14px"><span class="lbl">Payments</span>${r.payments.map(p => `<div class="dish num"><div class="dl"><span class="n">${day(p.at)} · ${PAY_KIND[p.kind]} · ${MODE_LABEL[p.mode]}</span><b>${p.amount < 0 ? '− ' : ''}${money(Math.abs(p.amount))}</b></div></div>`).join('')}</div>` : '';
  const packs = r.lines.reduce((t, l) => t + l.qty, 0);

  const body = `${header(ctx, taxed ? 'Tax invoice' : 'Invoice', `#${r.number}`, `Date ${day(r.day)}`, s.sweets_name)}
<div class="wrap">
  ${r.cancelled ? `<div class="void-stamp">Cancelled${r.cancelReason ? ` · ${esc(r.cancelReason)}` : ''}</div>` : ''}
  <div class="intro">
    <div class="fact"><span class="lbl">Bill to</span><span class="big">${esc(walkIn ? 'Walk-in customer' : r.name)}</span>
      ${r.phone ? `<span class="muted num">+91 ${esc(r.phone)}</span>` : ''}${r.address ? `<span class="muted">${esc(r.address)}</span>` : ''}</div>
    ${facts([['For', ref], ['Occasion', occasion], ...(r.kind === 'booking' ? [['Pickup / delivery', day(r.pickup)] as [string, string], ['Status', STAGE_LABEL[r.stage]] as [string, string]] : []),
      ...(r.paid ? [] : [['Payment', 'Not paid yet'] as [string, string]])])}
  </div>
  <section><div class="box"><table class="t"><thead><tr><th style="width:28px">#</th><th>Item</th><th>Pack</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead>
  <tbody>${r.lines.map((l, i) => `<tr><td class="muted">${i + 1}</td><td><b>${esc(l.item_name)}</b></td><td>${formatLineSize(l.weight, l.weight_unit)}</td><td class="r">${l.qty}</td><td class="r">${money(l.price)}</td><td class="r">${money(l.line_total)}</td></tr>`).join('')}</tbody></table></div>
  <div class="muted" style="margin-top:6px;font-size:12px">${r.lines.length} item${r.lines.length === 1 ? '' : 's'} · ${packs} pack${packs === 1 ? '' : 's'}${taxed ? ` · prices include GST ${rate}%` : ''}</div></section>
  <section class="split">
    <div><span class="lbl">Amount in words</span><div style="font-weight:600;margin-top:3px">${esc(amountInWords(r.total))}</div>${paid}
      ${r.notes ? `<div style="margin-top:12px"><span class="lbl">Note</span><div>${esc(r.notes)}</div></div>` : ''}
      ${payTo(ctx, r.due, ref, r.cancelled)}</div>
    <div><div class="sum">${sumRows(totals)}<div class="due"><span>${r.cancelled ? 'Cancelled' : r.due > 0 ? 'Balance due' : 'Fully paid'}</span><b class="num">${money(r.due)}</b></div></div>
      <div class="sw-sign"><div></div><span class="muted">For ${esc(s.sweets_name)} · Authorised signatory</span></div></div>
  </section>
  ${s.sweets_terms.length ? `<div class="sw-terms"><span class="lbl">Terms</span>${terms(s.sweets_terms)}</div>` : ''}
</div>
${endLine(ctx, `Thank you for choosing ${s.sweets_name}`)}`;

  return {
    html: page(`Invoice ${r.number} - ${r.name}`, s.accent, body, CSS),
    fileName: `${fileSafe(['Invoice', r.number, walkIn ? '' : r.name].filter(Boolean).join(' '))}.pdf`,
    footer: footerText(`Invoice #${r.number}`, walkIn ? undefined : r.name, s.sweets_name),
  };
}
