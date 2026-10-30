import type { Quotation } from '../../hooks/useQuotations';
import { DocContext, docContext } from './context';
import { scheduleAmounts } from './settings';
import { page, esc, money, cap } from './theme';
import { header, facts, sectionHead, sumRows, SumRow, banner, paySteps, chips, terms, upiBox, signatures, endLine, footerText } from './parts';
import { courseGrid, coursesOf, itemsTotal, hasItemPrices, mealSchedule, daysOf, mealTitle, mealSaving, offerOf, guestsText, dayLabel } from './menu';
import { formatDateIST } from '../ist';
import { addDays } from '../reports/model';

export interface Doc { html: string; fileName: string; footer: string }

const day = (d?: string) => (d ? formatDateIST(d, 'dd MMM yyyy') : '');
const fileSafe = (s: string) => s.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'Customer';
export const docFileName = (name: string | undefined, number: string) => `${fileSafe(name || 'Customer')}_${number}.pdf`;

const charges = (list?: { description: string; amount: number }[], fallback = 'Extra charge'): SumRow[] =>
  (list ?? []).filter(c => Number(c.amount) > 0).map(c => ({ label: c.description || fallback, value: Number(c.amount) }));

// Event date(s): the meal dates for multi-day quotes, else the booking's date and time.
function whenText(q: Quotation): string {
  const dates = daysOf(q.event_days).map(g => g.date).filter(Boolean).sort();
  if (q.is_multi_day && dates.length) return dates.length > 1 ? `${day(dates[0])} – ${day(dates[dates.length - 1])}` : day(dates[0]);
  const b = q.booking;
  const span = b?.end_date && b.end_date !== b.event_date ? `${day(b.event_date)} – ${day(b.end_date)}` : day(b?.event_date);
  return [span, b?.event_time].filter(Boolean).join(' · ');
}

// Price table + adjustments + closing banner, for per-plate, per-item and multi-meal quotes.
function priceSection(q: Quotation, itemPrices: boolean): string {
  const multi = !!q.is_multi_day && (q.event_days?.length ?? 0) > 0;
  const guests = q.guest_count || q.booking?.guest_count || 0;
  const rows: string[] = [];
  const adj: SumRow[] = [];
  let detail = '';
  let saved = 0;

  if (multi) {
    for (const g of daysOf(q.event_days)) for (const m of g.meals) {
      rows.push(`<tr><td>${esc(mealTitle(m))}<small>${esc(dayLabel(g))}</small></td><td class="r">${m.guest_count || 0}</td><td class="r">${money(m.per_plate_amount)}</td><td class="r">${money(m.subtotal)}</td></tr>`);
      if (mealSaving(m)) adj.push({ label: `${cap(m.meal_type)} offer · Day ${g.number} (${money(offerOf(m))} / plate)`, value: mealSaving(m), sign: '-' });
    }
    adj.push(...(q.additional_discounts ?? []).filter(d => Number(d.amount) > 0).map(d => ({ label: d.description || 'Discount', value: Number(d.amount), sign: '-' as const })));
    const meals = daysOf(q.event_days).reduce((s, g) => s + g.meals.length, 0);
    detail = `${meals} meal${meals === 1 ? '' : 's'} over ${daysOf(q.event_days).length} day${daysOf(q.event_days).length === 1 ? '' : 's'} · ${guestsText(q.event_days, guests)} guests`;
  } else if (itemPrices && itemsTotal(q.items) > 0) {
    const menu = itemsTotal(q.items);
    coursesOf(q.items).forEach(c => rows.push(`<tr><td>${esc(c.name)}<small>${c.count} ${c.count === 1 ? 'dish' : 'dishes'}</small></td><td class="r">${guests}</td><td class="r">${money(c.sum)}</td><td class="r">${money(c.sum * guests)}</td></tr>`));
    const diff = menu * guests - q.subtotal;
    if (diff > 0) adj.push({ label: `Special price · ${money(menu - q.per_plate_amount)} off per plate`, value: diff, sign: '-' });
    else if (diff < 0) adj.push({ label: 'Plate price adjustment', value: -diff, sign: '+' });
    detail = diff > 0
      ? `Menu value <s>${money(menu)}</s> · your price ${money(q.per_plate_amount)} per plate × ${guests} guests`
      : `${money(q.per_plate_amount)} per plate × ${guests} guests`;
  } else {
    const dishes = (q.items ?? []).length;
    rows.push(`<tr><td>Catering${q.booking?.event_type ? ` — ${esc(q.booking.event_type)}` : ''}<small>${dishes}-dish ${esc(q.food_type || '')} menu</small></td><td class="r">${guests}</td><td class="r">${money(q.per_plate_amount)}</td><td class="r">${money(q.subtotal)}</td></tr>`);
    detail = `${money(q.per_plate_amount)} per plate × ${guests} guests`;
  }
  if (!multi && q.discount_amount > 0) adj.push({ label: 'Discount', value: q.discount_amount, sign: '-' });
  saved = adj.filter(a => a.sign === '-').reduce((s, a) => s + a.value, 0);

  const sums: SumRow[] = [
    { label: multi ? 'Subtotal' : itemPrices && itemsTotal(q.items) > 0 ? 'Menu value' : 'Subtotal', value: multi || !(itemPrices && itemsTotal(q.items) > 0) ? q.subtotal : itemsTotal(q.items) * guests, cls: '' },
    ...adj,
    ...charges(q.extra_charges),
    ...charges(q.transportation_charges, 'Transportation'),
    ...(q.gst_rate > 0 && q.gst_amount > 0 ? [{ label: `GST @${q.gst_rate}%`, value: q.gst_amount }] : []),
  ];
  const head = multi ? '<th>Meal</th><th class="r">Guests</th><th class="r">Rate</th><th class="r">Amount</th>'
    : '<th>Description</th><th class="r">Guests</th><th class="r">Per plate</th><th class="r">Amount</th>';
  return `<section>${sectionHead('Price')}
  <div class="box"><table class="t"><thead><tr>${head}</tr></thead><tbody>${rows.join('')}</tbody></table></div>
  <div style="display:flex;justify-content:flex-end;margin-top:10px"><div class="sum" style="width:340px">${sumRows(sums)}</div></div>
  ${banner(q.gst_amount > 0 ? 'Total payable · incl. GST' : 'Total payable', detail, q.total_amount, saved > 0 ? `You save ${money(saved)}` : '')}
</section>`;
}

export function quotationDoc(q: Quotation, opts: { withPrices?: boolean } = {}, ctx: DocContext = docContext()): Doc {
  const s = ctx.settings;
  const b = q.booking;
  const multi = !!q.is_multi_day && (q.event_days?.length ?? 0) > 0;
  const allItems = multi ? (q.event_days ?? []).flatMap(d => (d.meals ?? []).flatMap(m => m.items ?? [])) : q.items ?? [];
  const itemPrices = opts.withPrices !== false && hasItemPrices(allItems);
  const issued = (q.issue_date || q.created_at || '').slice(0, 10);
  const validTill = issued ? addDays(issued, s.quote_valid_days) : '';
  const guests = guestsText(multi ? q.event_days : [], q.guest_count || b?.guest_count || 0);
  const firstStep = scheduleAmounts(q.total_amount, s.schedule)[0] ?? 0;

  const menuNote = multi
    ? `${daysOf(q.event_days).length} day(s) · ${daysOf(q.event_days).reduce((n, g) => n + g.meals.length, 0)} meal(s)`
    : [`${allItems.length} dishes`, itemPrices ? 'prices per plate' : '', q.food_type].filter(Boolean).join(' · ');

  const body = `${header(ctx, 'Quotation', q.quotation_number, `Issued ${day(issued)}${validTill ? ` · Valid till ${day(validTill)}` : ''}`)}
<div class="wrap">
  <div class="intro">
    <div class="fact"><span class="lbl">Prepared for</span><span class="big">${esc(q.customer?.name || 'Customer')}</span>
      ${q.customer?.phone ? `<span class="muted num">+91 ${esc(q.customer.phone)}</span>` : ''}</div>
    ${facts([['Event', b?.event_type], ['Date & time', whenText(q)], ['Venue', b?.venue], ['Guests · food', [guests && `${guests} guests`, q.food_type].filter(Boolean).join(' · ')]])}
  </div>
  <section>${sectionHead('The menu', menuNote)}${multi ? mealSchedule(q.event_days, { amounts: true, itemPrices }) : courseGrid(q.items ?? [], itemPrices)}</section>
  ${q.notes ? `<section>${sectionHead('Notes')}<div style="white-space:pre-line;font-size:13px">${esc(q.notes)}</div></section>` : ''}
  ${priceSection(q, itemPrices)}
  ${s.schedule.length ? `<section class="keep">${sectionHead('Payment schedule')}${paySteps(q.total_amount, s.schedule)}</section>` : ''}
  ${s.extras.length ? `<section class="keep">${sectionHead('On request, charged extra')}${chips(s.extras)}</section>` : ''}
  <div class="keep"><section>${sectionHead('Terms')}${terms([...s.terms, ...(validTill ? [`This quotation is valid till ${day(validTill)}.`] : [])])}</section>
  <div class="close">${signatures('Accepted by — signature & date', 'For Shiv Shakti Catering Service')}
    ${s.quote_qr ? upiBox(ctx, firstStep, `Confirm with ${money(firstStep)}`, `Booking ${q.quotation_number}`) : ''}</div></div>
</div>
${endLine(ctx, 'Thank you for considering Shiv Shakti Catering Service')}`;

  return {
    html: page(`Quotation ${q.quotation_number}`, s.accent, body),
    fileName: docFileName(q.customer?.name, q.quotation_number),
    footer: footerText(q.quotation_number, q.customer?.name, b?.event_type),
  };
}
