import type { QuotationLineItem, EventDay, MealSlot } from '../../hooks/useQuotations';
import { mealNet } from '../quoteMath';
import { formatDateIST } from '../ist';
import { esc, money, cap } from './theme';

// Menu blocks shared by quotations, invoices and the event menu.
interface Course { name: string; subs: { name: string; items: QuotationLineItem[] }[]; sum: number; count: number }

// Category → subcategory, both in first-appearance order.
export function coursesOf(items: QuotationLineItem[]): Course[] {
  const out: Course[] = [];
  for (const it of items ?? []) {
    const name = (it.category_name || it.subcategory_name || 'Menu').trim();
    let c = out.find(x => x.name === name);
    if (!c) { c = { name, subs: [], sum: 0, count: 0 }; out.push(c); }
    const subName = (it.subcategory_name || '').trim();
    let s = c.subs.find(x => x.name === subName);
    if (!s) { s = { name: subName, items: [] }; c.subs.push(s); }
    s.items.push(it);
    c.sum += Number(it.amount) || 0;
    c.count += 1;
  }
  return out;
}

export const itemsTotal = (items: QuotationLineItem[]) => (items ?? []).reduce((s, i) => s + (Number(i.amount) || 0), 0);
export const hasItemPrices = (items: QuotationLineItem[]) => (items ?? []).some(i => (Number(i.amount) || 0) > 0);

const dish = (it: QuotationLineItem, prices: boolean) => `<div class="dish"><span>${esc(it.item_name)}</span>${
  prices && Number(it.amount) > 0 ? `<span class="p num">${money(it.amount)}</span>` : ''}</div>${
  it.served_with ? `<div class="note with">Served with ${esc(it.served_with)}</div>` : ''}${
  it.instruction ? `<div class="note">Note: ${esc(it.instruction)}</div>` : ''}`;

// Two-column course list; per-item prices and course subtotals when `prices`.
export function courseGrid(items: QuotationLineItem[], prices: boolean): string {
  return `<div class="courses">${coursesOf(items).map(c => {
    const meta = prices && c.sum > 0 ? `${money(c.sum)} / plate` : `${c.count} ${c.count === 1 ? 'dish' : 'dishes'}`;
    const showSub = c.subs.length > 1 || (c.subs[0]?.name && c.subs[0].name !== c.name);
    return `<div class="course"><div class="course-h">${esc(c.name)}<span class="num">${meta}</span></div>${
      c.subs.map(s => `${showSub && s.name ? `<div class="sub">${esc(s.name)}</div>` : ''}${s.items.map(i => dish(i, prices)).join('')}`).join('')}</div>`;
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
  : `${money(m.per_plate_amount)} / plate`);

// Day → meal cards, each with its own menu; amounts hidden for kitchen copies.
export function mealSchedule(days: EventDay[] | undefined, opts: { amounts: boolean; itemPrices: boolean }): string {
  return daysOf(days).map(g => `<div class="day-h"><span>${esc(dayLabel(g))}</span>${
    opts.amounts ? `<span class="num">${money(g.meals.reduce((s, m) => s + mealNet(m), 0))}</span>` : ''}</div>${
    g.meals.map(m => `<div class="meal"><div class="meal-h"><div><b>${esc(mealTitle(m))}</b><div class="muted num" style="font-size:12px">${
      m.guest_count || 0} guests${opts.amounts && m.per_plate_amount ? ` · ${rateText(m)}` : ''}</div></div>${
      opts.amounts ? `<b class="num">${money(mealNet(m))}</b>` : ''}</div>
      <div class="meal-b">${(m.items ?? []).length ? courseGrid(m.items, opts.itemPrices) : '<span class="muted">Menu to be decided</span>'}${
      opts.amounts && mealSaving(m) ? `<div class="save num">Offer price saves ${money(mealSaving(m))} on this meal</div>` : ''}</div></div>`).join('')}`).join('');
}

// Guests or guest range across meals.
export function guestsText(days: EventDay[] | undefined, fallback: number): string {
  const counts = (days ?? []).flatMap(d => (d.meals ?? []).map(m => m.guest_count || 0)).filter(n => n > 0);
  if (!counts.length) return fallback > 0 ? String(fallback) : '';
  const lo = Math.min(...counts), hi = Math.max(...counts);
  return lo === hi ? String(lo) : `${lo} – ${hi}`;
}
