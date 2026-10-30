import type { QuotationLineItem, EventDay, MealSlot } from '../../hooks/useQuotations';
import { mealNet } from '../quoteMath';
import { formatDateIST } from '../ist';
import { esc, money, cap } from './theme';
import { choiceGroups, pickedOf, servedItems, ChoiceGroup } from '../quoteChoices';
import { planCourses, Course } from '../menuOrder';

// Menu blocks shared by quotations, invoices and the event menu.
// Courses in the owner's order with one Main Course and accompaniments last (lib/menuOrder).
export const coursesOf = (items: QuotationLineItem[]): Course[] => planCourses(items);

export const itemsTotal = (items: QuotationLineItem[]) => (items ?? []).reduce((s, i) => s + (Number(i.amount) || 0), 0);
export const hasItemPrices = (items: QuotationLineItem[]) => (items ?? []).some(i => (Number(i.amount) || 0) > 0);

const dish = (it: QuotationLineItem, prices: boolean) => `<div class="dish"><span>${esc(it.item_name)}</span>${
  prices && Number(it.amount) > 0 ? `<span class="p num">${money(it.amount)}</span>` : ''}</div>${
  it.served_with ? `<div class="note with">Served with ${esc(it.served_with)}</div>` : ''}${
  it.instruction ? `<div class="note">Note: ${esc(it.instruction)}</div>` : ''}`;

// "Choose any N" block: tick boxes for the customer, picked dishes ticked once decided.
function choiceBlock(g: ChoiceGroup, prices: boolean): string {
  const n = Math.min(Math.max(1, g.meta.pick), g.items.length);
  const decided = pickedOf(g).length > 0;
  const a = g.items.map(i => Number(i.amount) || 0).sort((x, y) => x - y);
  const lo = a.slice(0, n).reduce((s, x) => s + x, 0);
  const hi = a.slice(a.length - n).reduce((s, x) => s + x, 0);
  const priced = prices && !g.meta.included && hi > 0;
  const meta = decided ? 'chosen' : priced ? (lo === hi ? `+${money(lo)} / plate` : `+${money(lo)} – ${money(hi)} / plate`) : 'included';
  return `<div class="choice-box"><div class="choice-h">${esc(g.meta.label)} · ${decided ? 'your choice' : `choose any ${n}`}<span class="num">${meta}</span></div>${
    decided ? '' : '<div class="note" style="padding-left:0">Tick your choice.</div>'}${
    g.items.map(i => `<div class="dish"><span><span class="tick">${i.chosen ? '✓' : ''}</span>${esc(i.item_name)}</span>${
      priced && Number(i.amount) > 0 ? `<span class="p num">${money(i.amount)}</span>` : ''}</div>`).join('')}</div>`;
}

// Two-column course list; per-item prices and course subtotals when `prices`.
// "quote" shows choice groups to tick; "served" shows only what will be served.
export function courseGrid(all: QuotationLineItem[], prices: boolean, mode: 'quote' | 'served' = 'quote'): string {
  const items = mode === 'served' ? servedItems(all) : all;
  // Served copies list decided picks as normal dishes; open groups stay as a choice.
  const decided = new Set(choiceGroups(items).filter(g => pickedOf(g).length).map(g => g.meta.id));
  const groups = choiceGroups(items).filter(g => mode === 'quote' || !decided.has(g.meta.id));
  // Decided picks print as normal dishes; open choices sit inside their own course.
  const list = items.map(i => (i.choice && !groups.some(g => g.meta.id === i.choice!.id) ? { ...i, choice: undefined } : i));
  return `<div class="courses">${planCourses(list, { pair: true, groups }).map(c => {
    const meta = prices && c.sum > 0 ? `${money(c.sum)} / plate` : c.count ? `${c.count} ${c.count === 1 ? 'dish' : 'dishes'}` : '';
    const plain = c.subs.filter(x => !x.choice);
    const showSub = c.subs.length > 1 || (!!plain[0]?.name && plain[0].name !== c.name);
    return `<div class="course"><div class="course-h">${esc(c.name)}<span class="num">${meta}</span></div>${
      c.subs.map(x => (x.choice ? choiceBlock(x.choice, prices)
        : `${showSub && x.name ? `<div class="sub">${esc(x.name)}</div>` : ''}${x.items.map(i => dish(i, prices)).join('')}`)).join('')}</div>`;
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

export const mealTitle = (m: MealSlot) => [cap(m.meal_type), m.time, m.ceremony_name].filter(Boolean).join(' · ');
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
      <div class="meal-b">${(m.items ?? []).length ? courseGrid(m.items, opts.itemPrices, opts.mode) : '<span class="muted">Menu to be decided</span>'}${
      opts.amounts && mealSaving(m) ? `<div class="save num">Offer price saves ${money(mealSaving(m))} on this meal</div>` : ''}</div></div>`).join('')}`).join('');
}

// Guests or guest range across meals.
export function guestsText(days: EventDay[] | undefined, fallback: number): string {
  const counts = (days ?? []).flatMap(d => (d.meals ?? []).map(m => m.guest_count || 0)).filter(n => n > 0);
  if (!counts.length) return fallback > 0 ? String(fallback) : '';
  const lo = Math.min(...counts), hi = Math.max(...counts);
  return lo === hi ? String(lo) : `${lo} – ${hi}`;
}
