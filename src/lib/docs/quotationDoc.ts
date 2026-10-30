import type { Quotation } from '../../hooks/useQuotations';
import { DocContext, docContext } from './context';
import { scheduleAmounts } from './settings';
import { page, esc, money, cap } from './theme';
import { header, facts, sectionHead, sumRows, SumRow, banner, paySteps, chips, terms, upiBox, signatures, endLine, footerText } from './parts';
import { courseGrid, coursesOf, hasItemPrices, mealSchedule, daysOf, mealTitle, mealSaving, offerOf, guestsText, dayLabel } from './menu';
import { plateRange, choiceGroups, pickedOf } from '../quoteChoices';
import { optionTitle, statusText } from '../quoteOptions';
import { formatDateIST } from '../ist';
import { addDays } from '../reports/model';

export interface Doc { html: string; fileName: string; footer: string }

const day = (d?: string) => (d ? formatDateIST(d, 'dd MMM yyyy') : '');
const fileSafe = (s: string) => s.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'Customer';
export const docFileName = (name: string | undefined, number: string) => `${fileSafe(name || 'Customer')}_${number}.pdf`;

const charges = (list?: { description: string; amount: number }[], fallback = 'Extra charge'): SumRow[] =>
  (list ?? []).filter(c => Number(c.amount) > 0).map(c => ({ label: c.description || fallback, value: Number(c.amount) }));
const isMulti = (q: Quotation) => !!q.is_multi_day && (q.event_days?.length ?? 0) > 0;
const dishesOf = (q: Quotation) => (isMulti(q) ? (q.event_days ?? []).flatMap(d => (d.meals ?? []).flatMap(m => m.items ?? [])) : q.items ?? []);
const isRange = (q: Quotation) => !!q.total_max && q.total_max > q.total_amount;
const rangeText = (lo: number, hi: number) => (hi > lo ? `${money(lo)} – ${money(hi)}` : money(lo));

// Event date(s): the meal dates for multi-day quotes, else the booking's date and time.
function whenText(q: Quotation): string {
  const dates = daysOf(q.event_days).map(g => g.date).filter(Boolean).sort();
  if (isMulti(q) && dates.length) return dates.length > 1 ? `${day(dates[0])} – ${day(dates[dates.length - 1])}` : day(dates[0]);
  const b = q.booking;
  const span = b?.end_date && b.end_date !== b.event_date ? `${day(b.event_date)} – ${day(b.end_date)}` : day(b?.event_date);
  return [span, b?.event_time].filter(Boolean).join(' · ');
}

// Price table + adjustments + closing banner, for per-plate, per-item, "choose any" and multi-meal quotes.
function priceSection(q: Quotation, itemPrices: boolean, title = 'Price'): string {
  const multi = isMulti(q);
  const guests = q.guest_count || q.booking?.guest_count || 0;
  const rows: string[] = [];
  const adj: SumRow[] = [];
  const row = (name: string, sub: string, n: number, rate: string, amount: string) =>
    `<tr><td>${esc(name)}<small>${esc(sub)}</small></td><td class="r">${n}</td><td class="r">${rate}</td><td class="r">${amount}</td></tr>`;
  let detail = '';
  let first: SumRow = { label: 'Subtotal', value: q.subtotal, cls: '' };
  const range = plateRange(q.items);

  if (multi) {
    for (const g of daysOf(q.event_days)) for (const m of g.meals) {
      rows.push(row(mealTitle(m), dayLabel(g), m.guest_count || 0, rangeText(m.per_plate_amount, m.per_plate_max ?? 0), money(m.subtotal)));
      if (mealSaving(m)) adj.push({ label: `${cap(m.meal_type)} offer · Day ${g.number} (${money(offerOf(m))} / plate)`, value: mealSaving(m), sign: '-' });
    }
    adj.push(...(q.additional_discounts ?? []).filter(d => Number(d.amount) > 0).map(d => ({ label: d.description || 'Discount', value: Number(d.amount), sign: '-' as const })));
    const meals = daysOf(q.event_days).reduce((s, g) => s + g.meals.length, 0);
    detail = `${meals} meal${meals === 1 ? '' : 's'} over ${daysOf(q.event_days).length} day${daysOf(q.event_days).length === 1 ? '' : 's'} · ${guestsText(q.event_days, guests)} guests`;
  } else if (itemPrices && range.max > 0) {
    coursesOf((q.items ?? []).filter(i => !i.choice)).forEach(c => rows.push(row(c.name, `${c.count} ${c.count === 1 ? 'dish' : 'dishes'}`, guests, money(c.sum), money(c.sum * guests))));
    choiceGroups(q.items).filter(g => !g.meta.included).forEach(g => {
      const r = plateRange(g.items.map(i => ({ ...i, choice: { ...g.meta } })));
      const decided = pickedOf(g).length > 0;
      rows.push(row(g.meta.label, decided ? 'your choice' : `choose any ${g.meta.pick}`, guests, rangeText(r.min, r.max), rangeText(r.min * guests, r.max * guests)));
    });
    const diff = range.min * guests - q.subtotal;
    first = { label: isRange(q) ? 'Menu value (lowest picks)' : 'Menu value', value: range.min * guests, cls: '' };
    if (diff > 0) adj.push({ label: `Special price · ${money(range.min - q.per_plate_amount)} off per plate`, value: diff, sign: '-' });
    else if (diff < 0) adj.push({ label: 'Plate price adjustment', value: -diff, sign: '+' });
    detail = isRange(q) ? `${rangeText(q.per_plate_amount, q.per_plate_max ?? 0)} per plate × ${guests} guests · final once you choose`
      : diff > 0 ? `Menu value <s>${money(range.min)}</s> · your price ${money(q.per_plate_amount)} per plate × ${guests} guests`
      : `${money(q.per_plate_amount)} per plate × ${guests} guests`;
  } else {
    rows.push(row(`Catering${q.booking?.event_type ? ` — ${q.booking.event_type}` : ''}`, `${(q.items ?? []).length}-dish ${q.food_type || ''} menu`, guests, money(q.per_plate_amount), money(q.subtotal)));
    detail = `${money(q.per_plate_amount)} per plate × ${guests} guests`;
  }
  if (!multi && q.discount_amount > 0) adj.push({ label: 'Discount', value: q.discount_amount, sign: '-' });
  const saved = adj.filter(a => a.sign === '-').reduce((s, a) => s + a.value, 0);
  const sums: SumRow[] = [first, ...adj, ...charges(q.extra_charges), ...charges(q.transportation_charges, 'Transportation'),
    ...(q.gst_rate > 0 && q.gst_amount > 0 ? [{ label: `GST @${q.gst_rate}%`, value: q.gst_amount }] : [])];
  const head = `<th>${multi ? 'Meal' : 'Description'}</th><th class="r">Guests</th><th class="r">${multi ? 'Rate' : 'Per plate'}</th><th class="r">Amount</th>`;
  return `<section>${sectionHead(title)}
  <div class="box"><table class="t"><thead><tr>${head}</tr></thead><tbody>${rows.join('')}</tbody></table></div>
  <div style="display:flex;justify-content:flex-end;margin-top:10px"><div class="sum" style="width:340px">${sumRows(sums)}</div></div>
  ${banner(q.gst_amount > 0 ? 'Total payable · incl. GST' : 'Total payable', detail, isRange(q) ? rangeText(q.total_amount, q.total_max ?? 0) : q.total_amount, saved > 0 ? `You save ${money(saved)}` : '')}
</section>`;
}

const menuSection = (q: Quotation, itemPrices: boolean, title: string, breakBefore = false) => {
  const dishes = dishesOf(q);
  const note = isMulti(q)
    ? `${daysOf(q.event_days).length} day(s) · ${daysOf(q.event_days).reduce((n, g) => n + g.meals.length, 0)} meal(s)`
    : [`${dishes.length} dishes`, itemPrices ? 'prices per plate' : '', q.food_type].filter(Boolean).join(' · ');
  return `<section${breakBefore ? ' style="break-before:page"' : ''}>${sectionHead(title, note)}${
    isMulti(q) ? mealSchedule(q.event_days, { amounts: true, itemPrices }) : courseGrid(q.items ?? [], itemPrices)}</section>`;
};

// Side-by-side cards for options A / B / C.
const compareSection = (options: Quotation[]) => `<section class="keep">${sectionHead('Choose your menu', 'Pick one option')}
  <div class="compare" style="--n:${Math.min(options.length, 3)}">${options.map(o => `<div class="opt">
    <span class="kind" style="letter-spacing:1.5px">${esc(optionTitle(o))}</span>
    <b class="price num">${isMulti(o) ? rangeText(o.total_amount, o.total_max ?? 0) : `${rangeText(o.per_plate_amount, o.per_plate_max ?? 0)} <span style="font-size:13px;font-weight:500;color:#5C5C6B">/ plate</span>`}</b>
    ${isMulti(o) ? '' : `<span class="num">${rangeText(o.total_amount, o.total_max ?? 0)} total</span>`}
    <span class="muted" style="font-size:12px">${dishesOf(o).length} dishes${choiceGroups(dishesOf(o)).length ? ' · with choices' : ''}${o.status === 'accepted' || o.status === 'rejected' ? ` · ${statusText(o)}` : ''}</span>
  </div>`).join('')}</div></section>`;

export function quotationDoc(q: Quotation, opts: { withPrices?: boolean; options?: Quotation[] } = {}, ctx: DocContext = docContext()): Doc {
  const s = ctx.settings;
  const b = q.booking;
  // Unsaved edits of the open option replace its saved copy.
  const options = (opts.options?.length ?? 0) > 1 ? opts.options!.map(o => (o.id === q.id ? { ...o, ...q } : o)) : [q];
  const grouped = options.length > 1;
  const prices = (o: Quotation) => opts.withPrices !== false && hasItemPrices(dishesOf(o));
  const issued = (q.issue_date || q.created_at || '').slice(0, 10);
  const validTill = issued ? addDays(issued, s.quote_valid_days) : '';
  const guests = guestsText(isMulti(q) ? q.event_days : [], q.guest_count || b?.guest_count || 0);
  // Exact rupees only once the price is fixed; options and open choices show percentages.
  const open = grouped || isRange(q);
  const firstStep = open ? 0 : scheduleAmounts(q.total_amount, s.schedule)[0] ?? 0;

  const details = grouped
    ? options.map((o, i) => `${menuSection(o, prices(o), `${optionTitle(o)} — the menu`, i > 0)}${priceSection(o, prices(o), `${optionTitle(o)} — price`)}`).join('')
    : `${menuSection(q, prices(q), 'The menu')}${q.notes ? `<section>${sectionHead('Notes')}<div style="white-space:pre-line;font-size:13px">${esc(q.notes)}</div></section>` : ''}${priceSection(q, prices(q))}`;

  const body = `${header(ctx, grouped ? `Quotation · ${options.length} options` : 'Quotation', q.quotation_number, `Issued ${day(issued)}${validTill ? ` · Valid till ${day(validTill)}` : ''}`)}
<div class="wrap">
  <div class="intro">
    <div class="fact"><span class="lbl">Prepared for</span><span class="big">${esc(q.customer?.name || 'Customer')}</span>
      ${q.customer?.phone ? `<span class="muted num">+91 ${esc(q.customer.phone)}</span>` : ''}</div>
    ${facts([['Event', b?.event_type], ['Date & time', whenText(q)], ['Venue', b?.venue], ['Guests · food', [guests && `${guests} guests`, q.food_type].filter(Boolean).join(' · ')]])}
  </div>
  ${grouped ? compareSection(options) : ''}
  ${details}
  ${s.schedule.length ? `<section class="keep">${sectionHead('Payment schedule', open ? 'of the final total' : '')}${paySteps(open ? null : q.total_amount, s.schedule)}</section>` : ''}
  ${s.extras.length ? `<section class="keep">${sectionHead('On request, charged extra')}${chips(s.extras)}</section>` : ''}
  <div class="keep"><section>${sectionHead('Terms')}${terms([...s.terms, ...(validTill ? [`This quotation is valid till ${day(validTill)}.`] : [])])}</section>
  <div class="close">${signatures(grouped ? 'Accepted option ____ — signature & date' : 'Accepted by — signature & date', 'For Shiv Shakti Catering Service')}
    ${s.quote_qr ? upiBox(ctx, firstStep, firstStep ? `Confirm with ${money(firstStep)}` : 'Pay the booking amount', `Booking ${q.quotation_number}`) : ''}</div></div>
</div>
${endLine(ctx, 'Thank you for considering Shiv Shakti Catering Service')}`;

  return {
    html: page(`Quotation ${q.quotation_number}`, s.accent, body),
    fileName: docFileName(q.customer?.name, q.quotation_number),
    footer: footerText(q.quotation_number, q.customer?.name, b?.event_type),
  };
}
