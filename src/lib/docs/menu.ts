import type { QuotationLineItem, EventDay, MealSlot } from '../../hooks/useQuotations';
import { mealNet } from '../quoteMath';
import { formatDateIST } from '../ist';
import { esc, money, cap, timeText } from './theme';
import { choiceGroups, pickedOf, servedItems, plateRange, ChoiceGroup } from '../quoteChoices';
import { planCourses, servedNames, Course } from '../menuOrder';

// Menu blocks shared by quotations, invoices and the event menu.
// Courses in the owner's order with one Main Course and accompaniments last (lib/menuOrder).
export const coursesOf = (items: QuotationLineItem[]): Course[] => planCourses(items);

export const itemsTotal = (items: QuotationLineItem[]) => (items ?? []).reduce((s, i) => s + (Number(i.amount) || 0), 0);
export const hasItemPrices = (items: QuotationLineItem[]) => (items ?? []).some(i => (Number(i.amount) || 0) > 0);

// true: dish prices make up the plate price. 'diff': your own higher price, so only choice differences print.
export type PriceShow = boolean | 'diff';
export const priceShow = (on: boolean, plate: number, items: QuotationLineItem[] | undefined): PriceShow =>
  on && hasItemPrices(items ?? []) && plate > plateRange(items).min ? 'diff' : on;

// One dish line: tick box (choices), name, price; then "with …" and the owner's note.
function dish(it: QuotationLineItem, price: string, tick?: boolean): string {
  const served = servedNames(it);
  return `<div class="dish${tick === undefined ? '' : ' ticked'}"><div class="dl">${tick === undefined ? '' : `<span class="tick">${tick ? '✓' : ''}</span>`}<span class="n">${esc(it.item_name)}</span>${
    price ? `<span class="p num">${price}</span>` : ''}</div>${
    served.length ? `<div class="with">with ${esc(served.join(', '))}</div>` : ''}${
    it.instruction ? `<div class="note">${esc(it.instruction)}</div>` : ''}</div>`;
}
const itemPrice = (it: QuotationLineItem, prices: PriceShow) => (prices === true && Number(it.amount) > 0 ? money(it.amount) : '');

// "Choose any N": tick boxes for the customer, the picked ones ticked once decided.
// With your own plate price ('diff') each dish shows what it adds over the cheapest one.
function choiceParts(g: ChoiceGroup, prices: PriceShow) {
  const n = Math.min(Math.max(1, g.meta.pick), g.items.length);
  const decided = pickedOf(g).length > 0;
  const a = g.items.map(i => Number(i.amount) || 0).sort((x, y) => x - y);
  const lo = a.slice(0, n).reduce((s, x) => s + x, 0);
  const hi = a.slice(a.length - n).reduce((s, x) => s + x, 0);
  const diff = prices === 'diff';
  const priced = !decided && !!prices && !g.meta.included && (diff ? hi > lo : hi > 0);
  const price = (i: QuotationLineItem) => { const v = (Number(i.amount) || 0) - (diff ? a[0] : 0); return priced && v > 0 ? `${diff ? '+' : ''}${money(v)}` : ''; };
  const meta = !priced ? '' : diff ? `up to +${money(hi - lo)} / plate` : lo === hi ? `+${money(lo)} / plate` : `+${money(lo)} – ${money(hi)} / plate`;
  const title = `${esc(g.meta.label)} · ${decided ? 'your choice' : `choose any ${n}`}`;
  const hint = decided ? '' : `<div class="hint">Tick ${n === 1 ? 'one' : n}.${priced ? ' The plate price is final once you choose.' : ''}</div>`;
  const list = g.items.map(i => dish(i, price(i), !!i.chosen)).join('');
  return { title, meta, hint, list };
}

// Design A: two-column grid of course cards with flat dish lists; a course that is only a
// "choose any" group becomes a green choice card; a long course spans both columns.
// "quote" shows choice groups to tick; "served" shows only what will be served.
export function courseGrid(all: QuotationLineItem[], prices: PriceShow, mode: 'quote' | 'served' = 'quote'): string {
  const items = mode === 'served' ? servedItems(all) : all;
  const decided = new Set(choiceGroups(items).filter(g => pickedOf(g).length).map(g => g.meta.id));
  const groups = choiceGroups(items).filter(g => mode === 'quote' || !decided.has(g.meta.id));
  // Served copies list decided picks as normal dishes; open choices stay as choices.
  const list = items.map(i => (i.choice && !groups.some(g => g.meta.id === i.choice!.id) ? { ...i, choice: undefined } : i));
  return `<div class="courses">${planCourses(list, { merge: true, groups }).map(c => {
    if (c.entries.length === 1 && c.entries[0].choice) {
      const p = choiceParts(c.entries[0].choice, prices);
      return `<div class="course pick"><div class="course-h">${p.title}<span class="num">${p.meta}</span></div>${p.hint}${p.list}</div>`;
    }
    const meta = prices === true && c.sum > 0 ? `${money(c.sum)} / plate` : `${c.count} ${c.count === 1 ? 'dish' : 'dishes'}`;
    const body = c.entries.map(e => {
      if (!e.choice) return dish(e.item, itemPrice(e.item, prices));
      const p = choiceParts(e.choice, prices);
      return `<div class="pickbox"><div class="course-h">${p.title}<span class="num">${p.meta}</span></div>${p.hint}${p.list}</div>`;
    }).join('');
    return `<div class="course${c.entries.length > 8 ? ' wide' : ''}"><div class="course-h">${esc(c.name)}<span class="num">${meta}</span></div><div class="list">${body}</div></div>`;
  }).join('')}</div>`;
}

export interface DayGroup { number: number; date: string; meals: MealSlot[] }

// Entries sharing a date are one day (several meals on the same day).
export function daysOf(days: EventDay[] | undefined): DayGroup[] {
  const out: DayGroup[] = [];
  for (const d of days ?? []) {
    const key = d.date || `#${out.length}`;
    let g = out.find(x => (x.date || `#${x.number - 1}`) === key);
    if (!g) { g = { number: out.length + 1, date: d.date, meals: [] }; out.push(g); }
    g.meals.push(...(d.meals ?? []));
  }
  return out;
}

export const mealTitle = (m: MealSlot) => [cap(m.meal_type), timeText(m.time), m.ceremony_name].filter(Boolean).join(' · ');
export const offerOf = (m: MealSlot) => { const o = Number(m.discount_amount) || 0; return o > 0 && o < (Number(m.per_plate_amount) || 0) ? o : 0; };
export const mealSaving = (m: MealSlot) => (offerOf(m) ? (m.per_plate_amount - offerOf(m)) * (m.guest_count || 0) : 0);
export const dayLabel = (g: DayGroup) => `Day ${g.number}${g.date ? ` · ${formatDateIST(g.date, 'EEE, dd MMM yyyy')}` : ''}`;

const rateText = (m: MealSlot) => (offerOf(m)
  ? `<s>${money(m.per_plate_amount)}</s> ${money(offerOf(m))} / plate`
  : `${money(m.per_plate_amount)}${m.per_plate_max ? ` – ${money(m.per_plate_max)}` : ''} / plate`);

// Day → meal cards, each with its own menu; amounts hidden for kitchen copies.
export function mealSchedule(days: EventDay[] | undefined, opts: { amounts: boolean; itemPrices: boolean; mode?: 'quote' | 'served' }): string {
  return daysOf(days).map(g => `<div class="day-h"><span>${esc(dayLabel(g))}</span>${
    opts.amounts ? `<span class="num">${money(g.meals.reduce((s, m) => s + mealNet(m), 0))}</span>` : ''}</div>${
    g.meals.map(m => `<div class="meal"><div class="meal-h"><div><b>${esc(mealTitle(m))}</b><div class="muted num" style="font-size:12px">${
      m.guest_count || 0} guests${opts.amounts && m.per_plate_amount ? ` · ${rateText(m)}` : ''}</div></div>${
      opts.amounts ? `<b class="num">${money(mealNet(m))}${!offerOf(m) && m.per_plate_max ? ` – ${money(m.per_plate_max * (m.guest_count || 0))}` : ''}</b>` : ''}</div>
      <div class="meal-b">${(m.items ?? []).length ? courseGrid(m.items, priceShow(opts.itemPrices, m.per_plate_amount, m.items), opts.mode) : '<span class="muted">Menu to be decided</span>'}${
      opts.amounts && mealSaving(m) ? `<div class="save num">Offer price saves ${money(mealSaving(m))} on this meal</div>` : ''}</div></div>`).join('')}`).join('');
}

// Guests or guest range across meals.
export function guestsText(days: EventDay[] | undefined, fallback: number): string {
  const counts = (days ?? []).flatMap(d => (d.meals ?? []).map(m => m.guest_count || 0)).filter(n => n > 0);
  if (!counts.length) return fallback > 0 ? String(fallback) : '';
  const lo = Math.min(...counts), hi = Math.max(...counts);
  return lo === hi ? String(lo) : `${lo} – ${hi}`;
}
