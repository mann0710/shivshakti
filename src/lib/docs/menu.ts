import type { QuotationLineItem, EventDay, MealSlot } from '../../hooks/useQuotations';
import { mealNet } from '../quoteMath';
import { formatDateIST } from '../ist';
import { esc, money, cap, timeText } from './theme';
import { discountSaving, menuValueOf, plateOff, showsDishPrices, showsDiscount, Plate } from '../mealPrice';
import { planCourses, Course } from '../menuOrder';
import { courseGrid, priceShow } from './menuGrid';

// Menu blocks shared by quotations, invoices and the event menu.
// Courses in the owner's order with one Main Course and accompaniments last (lib/menuOrder).
export const coursesOf = (items: QuotationLineItem[]): Course[] => planCourses(items);

export const itemsTotal = (items: QuotationLineItem[]) => (items ?? []).reduce((s, i) => s + (Number(i.amount) || 0), 0);
export { courseGrid, hasItemPrices, priceShow } from './menuGrid';
export type { PriceShow } from './menuGrid';

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

// Menu value struck through before a fixed plate price; a ranged one names the rupees off instead.
export const wasText = (m: Plate, dishPrices = true) => (showsDiscount(m, dishPrices) && !m.per_plate_max ? `<s>${money(menuValueOf(m))}</s> ` : '');
const offText = (m: MealSlot, dishPrices: boolean) => (showsDiscount(m, dishPrices) && m.per_plate_max ? ` · ${money(plateOff(m))} off a plate` : '');
const rateText = (m: MealSlot, dishPrices: boolean) => (offerOf(m)
  ? `<s>${money(m.per_plate_amount)}</s> ${money(offerOf(m))} / plate`
  : `<span class="nw">${wasText(m, dishPrices)}${money(m.per_plate_amount)}${m.per_plate_max ? ` – ${money(m.per_plate_max)}` : ''} / plate</span>${offText(m, dishPrices)}${m.per_plate_max ? ', final once you choose' : ''}`);
// Top of a meal's amount while its picks are open (offers fix the price).
export const mealTop = (m: MealSlot) => (!offerOf(m) && m.per_plate_max ? m.per_plate_max * (m.guest_count || 0) : mealNet(m));
const span = (lo: number, hi: number) => `<span class="nw">${money(lo)}${hi > lo ? ` – ${money(hi)}` : ''}</span>`;

// Day → meal cards, each with its own menu; amounts hidden for kitchen copies.
export function mealSchedule(days: EventDay[] | undefined, opts: { amounts: boolean; itemPrices: boolean; mode?: 'quote' | 'served' }): string {
  return daysOf(days).map(g => `<div class="day-h"><span>${esc(dayLabel(g))}</span>${
    opts.amounts ? `<span class="num">${span(g.meals.reduce((s, m) => s + mealNet(m), 0), g.meals.reduce((s, m) => s + mealTop(m), 0))}</span>` : ''}</div>${
    g.meals.map(m => `<div class="meal"><div class="meal-h"><div><b>${esc(mealTitle(m))}</b><div class="muted num" style="font-size:12px">${
      m.guest_count || 0} guests${opts.amounts && m.per_plate_amount ? ` · ${rateText(m, opts.itemPrices)}` : ''}</div></div>${
      opts.amounts ? `<b class="num">${span(mealNet(m), mealTop(m))}</b>` : ''}</div>
      <div class="meal-b">${(m.items ?? []).length ? courseGrid(m.items, priceShow(opts.itemPrices && showsDishPrices(m), m.per_plate_amount, m.items), opts.mode, m.meal_type) : '<span class="muted">Menu to be decided</span>'}${
      opts.amounts && mealSaving(m) ? `<div class="save num">Offer price saves ${money(mealSaving(m))} on this meal</div>` : ''}${
      opts.amounts && discountSaving(m, opts.itemPrices) ? `<div class="save num">${money(plateOff(m))} off a plate saves ${money(discountSaving(m, opts.itemPrices))} on this meal</div>` : ''}</div></div>`).join('')}`).join('');
}

// Guests or guest range across meals.
export function guestsText(days: EventDay[] | undefined, fallback: number): string {
  const counts = (days ?? []).flatMap(d => (d.meals ?? []).map(m => m.guest_count || 0)).filter(n => n > 0);
  if (!counts.length) return fallback > 0 ? String(fallback) : '';
  const lo = Math.min(...counts), hi = Math.max(...counts);
  return lo === hi ? String(lo) : `${lo} – ${hi}`;
}
