import type { Invoice, Payment } from '../../types';
import type { Quotation } from '../../hooks/useQuotations';
import { DocContext, docContext } from './context';
import { page, esc, money, cap } from './theme';
import { header, facts, sectionHead, sumRows, SumRow, upiBox, endLine, footerText } from './parts';
import { courseGrid, mealSchedule, daysOf, mealTitle, mealSaving, offerOf, dayLabel, guestsText } from './menu';
import { Doc, docFileName } from './quotationDoc';
import { amountInWords, taxSplit, placeOfSupply } from '../gst';
import { modeLabel } from '../preorders';
import { formatDateIST } from '../ist';
import { SHOP } from '../shop';

const day = (d?: string) => (d ? formatDateIST(d, 'dd MMM yyyy') : '');

interface Line { title: string; sub?: string; qty: number; rate: number; amount: number }

// Billable lines: one per meal, else per-plate catering, else saved line items.
function linesOf(inv: Invoice, q?: Quotation): Line[] {
  const days = inv.event_days as Quotation['event_days'];
  if (inv.is_multi_day && days?.length) {
    return daysOf(days).flatMap(g => g.meals.map(m => ({
      title: mealTitle(m), sub: `${dayLabel(g)} · ${(m.items ?? []).length} dishes`,
      qty: m.guest_count || 0, rate: m.per_plate_amount || 0, amount: m.subtotal || 0,
    })));
  }
  const pp = q?.per_plate_amount ?? 0;
  if (pp > 0) {
    const dishes = q?.items?.length ?? 0;
    return [{ title: `Catering — ${inv.booking?.event_type || 'event'}`, sub: `${dishes}-dish ${q?.food_type || ''} menu`.replace(/\s+/g, ' '), qty: Math.round(inv.subtotal / pp), rate: pp, amount: inv.subtotal }];
  }
  if (inv.line_items?.length) return inv.line_items.map(l => ({ title: l.description, qty: l.quantity, rate: l.unit_price, amount: l.total }));
  return [{ title: `Catering — ${inv.booking?.event_type || 'event'}`, qty: 1, rate: inv.subtotal, amount: inv.subtotal }];
}

// Meal offers and named discounts when they add up to the saved discount, else one line.
function discountRows(inv: Invoice): SumRow[] {
  const total = Number(inv.discount_amount) || 0;
  if (!(total > 0)) return [];
  const days = inv.event_days as Quotation['event_days'];
  const parts: SumRow[] = [
    ...daysOf(days).flatMap(g => g.meals.filter(m => mealSaving(m) > 0).map(m => ({ label: `${cap(m.meal_type)} offer · Day ${g.number} (${money(offerOf(m))} / plate)`, value: mealSaving(m), sign: '-' as const }))),
    ...(inv.additional_discounts ?? []).filter(d => Number(d.amount) > 0).map(d => ({ label: d.description || 'Discount', value: Number(d.amount), sign: '-' as const })),
  ];
  const sum = parts.reduce((s, p) => s + p.value, 0);
  return inv.is_multi_day && Math.abs(sum - total) < 1 && parts.length ? parts : [{ label: 'Discount', value: total, sign: '-' }];
}

export function invoiceDoc(inv: Invoice, q: Quotation | undefined, payments: Payment[], ctx: DocContext = docContext()): Doc {
  const s = ctx.settings;
  const b = inv.booking;
  const c = b?.customer;
  const taxed = inv.gst_rate > 0 && inv.gst_amount > 0;
  const extras = (inv.extra_charges ?? []).filter(e => Number(e.amount) > 0);
  const transport = Number(inv.transportation_charge) || 0;
  const lines: Line[] = [
    ...linesOf(inv, q),
    ...extras.map(e => ({ title: e.description || 'Extra charge', qty: 1, rate: e.amount, amount: e.amount })),
    ...(transport > 0 ? [{ title: 'Transportation', qty: 1, rate: transport, amount: transport }] : []),
  ];
  const gross = lines.reduce((t, l) => t + l.amount, 0);
  const sac = taxed ? `<td>${SHOP.sac}</td>` : '';
  const span = b?.end_date && b.end_date !== b.event_date ? `${day(b.event_date)} – ${day(b.end_date)}` : day(b?.event_date);

  const totals: SumRow[] = [
    { label: 'Subtotal', value: gross, cls: '' },
    ...discountRows(inv),
    ...(taxed ? [{ label: 'Taxable value', value: inv.total_amount - inv.gst_amount, cls: 'line' }] : []),
    ...taxSplit(inv.gst_amount, inv.gst_rate, ctx.gstNumber, c?.gstin).map(t => ({ label: t.label, value: t.amount })),
    { label: 'Invoice total', value: inv.total_amount, cls: 'tot' },
    ...(inv.advance_paid > 0 ? [{ label: 'Paid', value: inv.advance_paid, sign: '-' as const }] : []),
  ];
  const paid = s.invoice_payments && payments.length
    ? `<div style="margin-top:14px"><span class="lbl">Payments received</span>${payments.map(p => `<div class="dish num"><div class="dl"><span class="n">${day(p.payment_date)} · ${cap(p.payment_type)} · ${modeLabel(p.payment_mode)}</span><b>${money(p.amount)}</b></div></div>`).join('')}</div>` : '';
  const menu = inv.is_multi_day && (inv.event_days as unknown[] | undefined)?.length
    ? mealSchedule(inv.event_days as Quotation['event_days'], { amounts: false, itemPrices: false, mode: 'served' })
    : q?.items?.length ? courseGrid(q.items, false, 'served') : '';

  const body = `${header(ctx, taxed ? 'Tax invoice' : 'Invoice', inv.invoice_number, `Date ${day(inv.issue_date)}`)}
<div class="wrap">
  <div class="intro">
    <div class="fact"><span class="lbl">Bill to</span><span class="big">${esc(c?.name || 'Customer')}</span>
      ${c?.phone ? `<span class="muted num">+91 ${esc(c.phone)}</span>` : ''}${c?.address ? `<span class="muted">${esc(c.address)}</span>` : ''}
      ${c?.gstin ? `<span class="num"><b>GSTIN</b> ${esc(c.gstin)}</span>` : ''}</div>
    ${facts([['Event', b?.event_type], ['Date & time', [span, b?.event_time].filter(Boolean).join(' · ')], ['Venue', b?.venue],
      ['Guests', guestsText(inv.is_multi_day ? (inv.event_days as Quotation['event_days']) : [], b?.guest_count || 0)], ...(taxed ? [['Place of supply', placeOfSupply(ctx.gstNumber, c?.gstin)] as [string, string]] : []),
      ['Quotation', q?.quotation_number]])}
  </div>
  <section><div class="box"><table class="t"><thead><tr><th style="width:28px">#</th><th>Description</th>${taxed ? '<th>SAC</th>' : ''}<th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead>
  <tbody>${lines.map((l, i) => `<tr><td class="muted">${i + 1}</td><td><b>${esc(l.title)}</b>${l.sub ? `<small>${esc(l.sub)}</small>` : ''}</td>${sac}<td class="r">${l.qty}</td><td class="r">${money(l.rate)}</td><td class="r">${money(l.amount)}</td></tr>`).join('')}</tbody></table></div></section>
  <section class="split">
    <div><span class="lbl">Amount in words</span><div style="font-weight:600;margin-top:3px">${esc(amountInWords(inv.total_amount))}</div>${paid}</div>
    <div class="sum">${sumRows(totals)}<div class="due"><span>${inv.balance_due > 0 ? 'Balance due' : 'Fully paid'}</span><b class="num">${money(Math.max(0, inv.balance_due))}</b></div></div>
  </section>
  <div class="close">${s.invoice_qr && inv.balance_due > 0 ? upiBox(ctx, inv.balance_due, `Pay the balance ${money(inv.balance_due)}`, inv.invoice_number) : '<div></div>'}
    <div style="text-align:right"><div style="height:46px;border-bottom:1px solid #1C1C24;margin-left:60px"></div><span class="muted" style="font-size:12px">Authorised signatory</span></div></div>
  ${s.invoice_menu && menu ? `<section style="break-before:page">${sectionHead('Menu served', [b?.event_type, span].filter(Boolean).join(' · '))}${menu}</section>` : ''}
</div>
${endLine(ctx, 'Thank you for choosing Shiv Shakti Catering Service')}`;

  return {
    html: page(`Invoice ${inv.invoice_number}`, s.accent, body),
    fileName: docFileName(c?.name, inv.invoice_number),
    footer: footerText(inv.invoice_number, c?.name, b?.event_type),
  };
}

// Kitchen / event menu from the calendar: no prices.
export function eventMenuDoc(b: Invoice['booking'], q: Quotation | undefined, ctx: DocContext = docContext()): Doc {
  const multi = !!q?.is_multi_day && (q.event_days?.length ?? 0) > 0;
  const span = b?.end_date && b.end_date !== b.event_date ? `${day(b.event_date)} – ${day(b.end_date)}` : day(b?.event_date);
  const body = `${header(ctx, 'Event menu', b?.event_type || 'Event', span)}
<div class="wrap">
  <div class="intro">
    <div class="fact"><span class="lbl">Customer</span><span class="big">${esc(b?.customer?.name || '—')}</span>${b?.customer?.phone ? `<span class="muted num">+91 ${esc(b.customer.phone)}</span>` : ''}</div>
    ${facts([['Date & time', [span, b?.event_time].filter(Boolean).join(' · ')], ['Venue', b?.venue], ['Guests', b?.guest_count || ''], ['Food', q?.food_type]])}
  </div>
  <section>${sectionHead('Menu', q?.quotation_number ?? '')}${multi ? mealSchedule(q!.event_days, { amounts: false, itemPrices: false, mode: 'served' })
    : q?.items?.length ? courseGrid(q.items, false, 'served') : '<span class="muted">No menu linked to this event yet.</span>'}</section>
  ${q?.notes ? `<section>${sectionHead('Notes')}<div style="white-space:pre-line">${esc(q.notes)}</div></section>` : ''}
</div>`;
  return {
    html: page(`Event menu ${b?.event_type ?? ''}`, ctx.settings.accent, body),
    fileName: docFileName(b?.customer?.name, `Menu_${b?.event_date ?? ''}`),
    footer: footerText('Event menu', b?.customer?.name, span),
  };
}
