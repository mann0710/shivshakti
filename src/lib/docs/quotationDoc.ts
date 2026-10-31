import type { Quotation } from '../../hooks/useQuotations';
import { DocContext, docContext } from './context';
import { scheduleAmounts } from './settings';
import { page, esc, money, cap, timeText } from './theme';
import { header, facts, sectionHead, sumRows, SumRow, banner, paySteps, StepOption, chips, terms, upiBox, signatures, endLine, footerText } from './parts';
import { courseGrid, coursesOf, hasItemPrices, priceShow, PriceShow, mealSchedule, daysOf, mealTitle, mealSaving, offerOf, guestsText, dayLabel } from './menu';
import { plateRange, choiceGroups, pickedOf, dishCount } from '../quoteChoices';
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
  return [span, timeText(b?.event_time)].filter(Boolean).join(' · ');
}

// Price table + adjustments + closing banner, for per-plate, per-item, "choose any" and multi-meal quotes.
function priceSection(q: Quotation, itemPrices: PriceShow, title = 'Price'): string {
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
  } else if (itemPrices === true && range.max > 0) {
    // Dish prices make up the plate price: one row per priced course and choice, ₹0 rows left out.
    coursesOf((q.items ?? []).filter(i => !i.choice)).filter(c => c.sum > 0).forEach(c => rows.push(row(c.name, `${c.count} ${c.count === 1 ? 'dish' : 'dishes'}`, guests, money(c.sum), money(c.sum * guests))));
    choiceGroups(q.items).filter(g => !g.meta.included).forEach(g => {
      const r = plateRange(g.items.map(i => ({ ...i, choice: { ...g.meta } })));
      const decided = pickedOf(g).length > 0;
      if (r.max > 0) rows.push(row(g.meta.label, decided ? 'your choice' : `choose any ${g.meta.pick}`, guests, rangeText(r.min, r.max), rangeText(r.min * guests, r.max * guests)));
    });
    const diff = range.min * guests - q.subtotal;
    first = { label: 'Menu value', value: range.min * guests, max: isRange(q) ? range.max * guests : undefined, cls: '' };
    if (diff > 0) adj.push({ label: `Special price · ${money(range.min - q.per_plate_amount)} off per plate`, value: diff, sign: '-' });
    detail = isRange(q) ? `${rangeText(q.per_plate_amount, q.per_plate_max ?? 0)} per plate × ${guests} guests · final once you choose`
      : diff > 0 ? `Menu value <s>${money(range.min)}</s> · your price ${money(q.per_plate_amount)} per plate × ${guests} guests`
      : `${money(q.per_plate_amount)} per plate × ${guests} guests`;
  } else {
    // Your own plate price: one catering line, a range while choices are open.
    const top = isRange(q) ? q.per_plate_max ?? 0 : 0;
    rows.push(row(`Catering${q.booking?.event_type ? ` — ${q.booking.event_type}` : ''}`, `${dishCount(q.items)}-dish ${q.food_type || ''} menu`, guests, rangeText(q.per_plate_amount, top), rangeText(q.subtotal, top * guests)));
    first = { label: 'Subtotal', value: q.subtotal, max: top * guests, cls: '' };
    detail = `${rangeText(q.per_plate_amount, top)} per plate × ${guests} guests${top ? ' · final once you choose' : ''}`;
  }
  if (!multi && q.discount_amount > 0) adj.push({ label: 'Discount', value: q.discount_amount, sign: '-' });
  const saved = adj.filter(a => a.sign === '-').reduce((s, a) => s + a.value, 0);
  const sums: SumRow[] = [first, ...adj, ...charges(q.extra_charges), ...charges(q.transportation_charges, 'Transportation'),
    ...(q.gst_rate > 0 && q.gst_amount > 0 ? [{ label: `GST @${q.gst_rate}%`, value: q.gst_amount }] : [])];
  const head = `<th>${multi ? 'Meal' : 'Description'}</th><th class="r">Guests</th><th class="r">${multi ? 'Rate' : 'Per plate'}</th><th class="r">Amount</th>`;
  return `<section>${sectionHead(title)}
  <div class="box"><table class="t"><thead><tr>${head}</tr></thead><tbody>${rows.join('')}</tbody></table></div>
  <div class="keep"><div style="display:flex;justify-content:flex-end;margin-top:10px"><div class="sum" style="width:340px">${sumRows(sums)}</div></div>
  ${banner(q.gst_amount > 0 ? 'Total payable · incl. GST' : 'Total payable', detail, isRange(q) ? rangeText(q.total_amount, q.total_max ?? 0) : q.total_amount, saved > 0 ? `You save ${money(saved)}` : '')}</div>
</section>`;
}

const menuSection = (q: Quotation, itemPrices: PriceShow, title: string) => {
  const dishes = dishesOf(q);
  const note = isMulti(q)
    ? `${daysOf(q.event_days).length} day(s) · ${daysOf(q.event_days).reduce((n, g) => n + g.meals.length, 0)} meal(s)`
    : [`${dishCount(dishes)} dishes`, itemPrices === true ? 'prices per plate' : '', q.food_type].filter(Boolean).join(' · ');
  return `<section>${sectionHead(title, note)}${
    isMulti(q) ? mealSchedule(q.event_days, { amounts: true, itemPrices: !!itemPrices }) : courseGrid(q.items ?? [], itemPrices)}</section>`;
};

// Side-by-side cards for options A / B / C.
const compareSection = (options: Quotation[]) => `<section class="keep">${sectionHead('Choose your menu', 'Pick one option')}
  <div class="compare" style="--n:${Math.min(options.length, 3)}">${options.map(o => `<div class="opt">
    <span class="kind" style="letter-spacing:1.5px">${esc(optionTitle(o))} · ${esc(o.quotation_number)}</span>
    <b class="price num">${isMulti(o) ? rangeText(o.total_amount, o.total_max ?? 0) : `${rangeText(o.per_plate_amount, o.per_plate_max ?? 0)} <span style="font-size:13px;font-weight:500;color:#5C5C6B">/ plate</span>`}</b>
    ${isMulti(o) ? '' : `<span class="num">${rangeText(o.total_amount, o.total_max ?? 0)} total</span>`}
    <span class="muted" style="font-size:12px">${dishCount(dishesOf(o))} dishes${choiceGroups(dishesOf(o)).length ? ' · with choices' : ''}${o.status === 'accepted' || o.status === 'rejected' ? ` · ${statusText(o)}` : ''}</span>
  </div>`).join('')}</div></section>`;

export function quotationDoc(q: Quotation, opts: { withPrices?: boolean; options?: Quotation[] } = {}, ctx: DocContext = docContext()): Doc {
  const s = ctx.settings;
  const b = q.booking;
  // Unsaved edits of the open option replace its saved copy.
  const options = (opts.options?.length ?? 0) > 1 ? opts.options!.map(o => (o.id === q.id ? { ...o, ...q } : o)) : [q];
  const grouped = options.length > 1;
  // One PDF for all options carries the first option's number; a single option is labelled "Option A".
  const number = grouped ? options[0].quotation_number : q.quotation_number;
  const kind = grouped ? `Quotation · ${options.length} options` : q.option_label ? `Quotation · ${optionTitle(q)}` : 'Quotation';
  const perOption: StepOption[] = grouped ? options.map(o => ({ label: `Option ${o.option_label}`, lo: o.total_amount, hi: o.total_max ?? 0 })) : [];
  const prices = (o: Quotation) => priceShow(opts.withPrices !== false && hasItemPrices(dishesOf(o)), o.per_plate_amount, o.items);
  const issued = (q.issue_date || q.created_at || '').slice(0, 10);
  const validTill = issued ? addDays(issued, s.quote_valid_days) : '';
  const guests = guestsText(isMulti(q) ? q.event_days : [], q.guest_count || b?.guest_count || 0);
  // Exact rupees only once the price is fixed; options and open choices show percentages.
  const open = grouped || isRange(q);
  const firstStep = open ? 0 : scheduleAmounts(q.total_amount, s.schedule)[0] ?? 0;

  const details = grouped
    ? options.map(o => `${menuSection(o, prices(o), `${optionTitle(o)} — the menu`)}${priceSection(o, prices(o), `${optionTitle(o)} — price`)}`).join('')
    : `${menuSection(q, prices(q), 'The menu')}${q.notes ? `<section>${sectionHead('Notes')}<div style="white-space:pre-line;font-size:13px">${esc(q.notes)}</div></section>` : ''}${priceSection(q, prices(q))}`;

  const body = `${header(ctx, kind, number, `Issued ${day(issued)}${validTill ? ` · Valid till ${day(validTill)}` : ''}`)}
<div class="wrap">
  <div class="intro">
    <div class="fact"><span class="lbl">Prepared for</span><span class="big">${esc(q.customer?.name || 'Customer')}</span>
      ${q.customer?.phone ? `<span class="muted num">+91 ${esc(q.customer.phone)}</span>` : ''}</div>
    ${facts([['Event', b?.event_type], ['Date & time', whenText(q)], ['Venue', b?.venue], ['Guests · food', [guests && `${guests} guests`, q.food_type].filter(Boolean).join(' · ')]])}
  </div>
  ${grouped ? compareSection(options) : ''}
  ${details}
  ${s.schedule.length ? `<section class="keep">${sectionHead('Payment schedule', grouped ? 'of the option you choose' : open ? 'final once you choose' : '')}${paySteps(grouped ? null : q.total_amount, s.schedule, perOption, isRange(q) ? q.total_max ?? 0 : 0)}</section>` : ''}
  ${s.extras.length ? `<section class="keep">${sectionHead('On request, charged extra')}${chips(s.extras)}</section>` : ''}
  <div class="keep"><section>${sectionHead('Terms')}${terms([...s.terms, ...(validTill ? [`This quotation is valid till ${day(validTill)}.`] : [])])}</section>
  <div class="close">${signatures(grouped ? 'Accepted option ____ — signature & date' : 'Accepted by — signature & date', `For ${ctx.settings.catering_name}`)}
    ${s.quote_qr ? upiBox(ctx, firstStep, firstStep ? `Confirm with ${money(firstStep)}` : 'Pay the booking amount', `Booking ${q.quotation_number}`) : ''}</div></div>
</div>
${endLine(ctx, `Thank you for considering ${ctx.settings.catering_name}`)}`;

  return {
    html: page(`Quotation ${number}`, s.accent, body),
    fileName: docFileName(q.customer?.name, grouped ? `${number}_Options_${options.map(o => o.option_label).join('')}` : `${number}${q.option_label ? `_Option_${q.option_label}` : ''}`),
    footer: footerText(grouped ? `${number} · ${options.length} options` : number, q.customer?.name, b?.event_type),
  };
}
