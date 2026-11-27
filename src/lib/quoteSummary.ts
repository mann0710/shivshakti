import type { EventDay, MealSlot, Quotation, QuotationLineItem } from '../hooks/useQuotations';
import type { Booking } from '../types';
import { inr } from './money';
import { formatDateIST } from './ist';
import { scheduleAmounts, PayStep } from './docs/settings';
import { mealSaving, mealTitle, offerOf } from './docs/menu';
import { planCourses, Course } from './menuOrder';
import { choiceGroups } from './quoteChoices';
import { discountSaving, hasDishPrices, plateOff, quotePlate, showsDiscount, showsDishPrices } from './mealPrice';
import { plateText, totalText, quoteGuests } from './quoteOptions';

// What the quote editor and the list panel show about one quote.
export const range = (lo: number, hi?: number | null) => (hi != null && hi > lo ? `${inr(lo)} – ${inr(hi)}` : inr(lo));

export const quoteItems = (q: Pick<Quotation, 'is_multi_day' | 'event_days' | 'items'>): QuotationLineItem[] =>
  q.is_multi_day ? (q.event_days ?? []).flatMap(d => d.meals.flatMap(m => m.items ?? [])) : q.items ?? [];

export const coursesOf = (items: QuotationLineItem[]): Course[] => planCourses(items, { groups: choiceGroups(items) });

export interface Line { k: string; v: string; muted?: boolean }

// Price lines as the customer sees them, ending before the total.
export function priceLines(q: Quotation, dishPrices = true): Line[] {
  const out: Line[] = [];
  if (q.is_multi_day) {
    // Two dinners on two days read apart only with their day.
    const days = new Set((q.event_days ?? []).map(d => d.date)).size > 1;
    (q.event_days ?? []).forEach(d => d.meals.forEach(m => {
      const rate = offerOf(m) || m.per_plate_amount;
      const hi = m.per_plate_max != null && m.per_plate_max > m.per_plate_amount ? m.per_plate_max * m.guest_count : null;
      const off = !offerOf(m) && showsDiscount(m, dishPrices) ? ` (${inr(plateOff(m))} off)` : '';
      const day = days && d.date ? `${formatDateIST(d.date, 'EEE d MMM')} · ` : '';
      out.push({ k: `${day}${mealTitle(m)} · ${m.guest_count} × ${inr(rate)}${off}`, v: range(rate * m.guest_count, hi) });
    }));
  } else {
    const g = quoteGuests(q);
    const hi = q.per_plate_max != null && q.per_plate_max > q.per_plate_amount ? q.per_plate_max * g : null;
    const off = showsDiscount(quotePlate(q, g), dishPrices) ? ` (${inr(plateOff(quotePlate(q, g)))} off)` : '';
    out.push({ k: `${plateText(q)}${off} × ${g}`, v: range(q.per_plate_amount * g, hi) });
  }
  (q.additional_discounts ?? []).filter(d => d.amount > 0).forEach(d => out.push({ k: d.description || 'Discount', v: `− ${inr(d.amount)}` }));
  (q.extra_charges ?? []).filter(c => c.amount > 0).forEach(c => out.push({ k: c.description || 'Extra', v: inr(c.amount) }));
  (q.transportation_charges ?? []).filter(c => c.amount > 0).forEach(c => out.push({ k: c.description || 'Transport', v: inr(c.amount) }));
  out.push(q.gst_rate > 0 ? { k: `GST ${q.gst_rate}%`, v: inr(q.gst_amount) } : { k: 'GST', v: 'Not added', muted: true });
  return out;
}

// What the customer saves on the PDF: plate discounts, older offer prices and discounts on the total.
export function youSave(q: Quotation, dishPrices = true): number {
  const plates = q.is_multi_day
    ? (q.event_days ?? []).reduce((s, d) => s + d.meals.reduce((t, m) => t + discountSaving(m, dishPrices) + mealSaving(m), 0), 0)
    : discountSaving(quotePlate(q, quoteGuests(q)), dishPrices);
  return plates + (q.additional_discounts ?? []).reduce((s, d) => s + (Number(d.amount) || 0), 0);
}

// "On the PDF" notes for meals that differ: dish prices left off, plate discounts shown.
export function pdfSummary(days: EventDay[], dishPrices: boolean): string[] {
  const name = (d: EventDay, m: MealSlot) => `${mealTitle(m)}${d.date ? ` (${formatDateIST(d.date, 'EEE d MMM')})` : ''}`;
  const meals = days.flatMap(d => d.meals.map(m => ({ d, m })));
  const off = meals.filter(x => dishPrices && hasDishPrices(x.m) && !showsDishPrices(x.m)).map(x => name(x.d, x.m));
  const disc = meals.filter(x => showsDiscount(x.m, dishPrices)).map(x => `${name(x.d, x.m)} ${inr(plateOff(x.m))} off`);
  return [off.length ? `Dish prices off for: ${off.join(', ')}` : '', disc.length ? `Plate discount shown on: ${disc.join(', ')}` : ''].filter(Boolean);
}

export interface Check { tone: 'ok' | 'warn' | 'bad'; text: string }
const s = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

// "Ready to send?" list in the editor.
export function readyChecks(c: {
  date: string; time: string; guests: number; multiDay: boolean; undated: number;
  dishes: number; courses: number; picks: string[]; total: number; planPct: number | null;
}): Check[] {
  const out: Check[] = [];
  if (!c.date) out.push({ tone: 'bad', text: 'Event date not set' });
  else if (c.multiDay) out.push(c.undated ? { tone: 'bad', text: `${s(c.undated, 'day')} without a date` } : { tone: 'ok', text: 'Dates, meals and guests set' });
  else if (c.guests <= 0) out.push({ tone: 'bad', text: 'Guest count missing' });
  else out.push(c.time ? { tone: 'ok', text: `Date, time and ${c.guests} guests set` } : { tone: 'warn', text: `Date and ${c.guests} guests set · no time yet` });
  out.push(c.dishes ? { tone: 'ok', text: `${s(c.dishes, 'dish', 'dishes')} in ${s(c.courses, 'course')}` } : { tone: 'bad', text: 'No dishes yet' });
  if (c.picks.length) out.push({ tone: 'warn', text: `${s(c.picks.length, 'choice')} left for the customer (${c.picks.join(', ').toLowerCase()})` });
  if (c.total <= 0) out.push({ tone: 'bad', text: 'No price yet' });
  if (c.planPct != null) out.push(c.planPct === 100 ? { tone: 'ok', text: 'Payment plan adds up to 100%' } : { tone: 'warn', text: `Payment plan adds up to ${c.planPct}% — change it in Settings` });
  return out;
}

// Payment steps with their amounts (a range while the customer still picks).
export const planRows = (lo: number, hi: number | null, steps: PayStep[]) => {
  const a = scheduleAmounts(lo, steps);
  const b = hi != null && hi > lo ? scheduleAmounts(hi, steps) : a;
  return steps.map((st, i) => ({ pct: `${st.pct}%`, text: [st.label, st.when].filter(Boolean).join(' · '), amount: range(a[i], b[i]) }));
};

// One course in the compare table: fixed dishes by name (or a count), then "Pick 1 of 3".
const courseCell = (c?: Course) => {
  if (!c) return '—';
  const fixed = c.entries.filter(e => e.item).map(e => e.item!.item_name);
  const picks = c.entries.filter(e => e.choice).map(e => `Pick ${Math.min(Math.max(1, e.choice!.meta.pick), e.choice!.items.length)} of ${e.choice!.items.length}`);
  return [fixed.length > 3 ? `${fixed.length} dishes` : fixed.join(', '), ...picks].filter(Boolean).join(' · ') || '—';
};

export interface CompareRow { label: string; cells: string[]; differs: boolean; strong?: boolean }

// Options side by side; rows that differ are marked.
export function compareRows(options: Quotation[]): CompareRow[] {
  const plans = options.map(o => coursesOf(quoteItems(o)));
  const names = Array.from(new Set(plans.flatMap(p => p.map(c => c.name))));
  const rows: Omit<CompareRow, 'differs'>[] = [
    { label: 'Plate price', cells: options.map(o => (o.is_multi_day ? 'By meal' : plateText(o))), strong: true },
    { label: 'Guests', cells: options.map(o => String(quoteGuests(o) || '—')) },
    ...names.map(n => ({ label: n, cells: plans.map(p => courseCell(p.find(c => c.name === n))) })),
    { label: 'Extras', cells: options.map(o => (o.extra_charges ?? []).filter(c => c.amount > 0).map(c => `${c.description || 'Extra'} ${inr(c.amount)}`).join(', ') || '—') },
    { label: 'Total', cells: options.map(o => totalText(o)), strong: true },
  ];
  return rows.map(r => ({ ...r, differs: new Set(r.cells).size > 1 }));
}

// "10%" of the base, or a plain amount ("₹1,500").
export function parseAmount(text: string, base: number): number {
  const t = text.replace(/[₹,\s]/g, '');
  const pct = /^(\d+(?:\.\d+)?)%$/.exec(t);
  if (pct) return Math.round((base * parseFloat(pct[1])) / 100);
  return Math.max(0, parseFloat(t) || 0);
}

// "quoted, waiting for Kavit"
export function stageText(b: Pick<Booking, 'status'> & { customer?: { name?: string } | null }): string {
  const first = String(b.customer?.name || 'the customer').trim().split(/\s+/)[0];
  return ({ inquiry: 'inquiry', followup: `quoted, waiting for ${first}`, pending: 'pending', confirmed: 'confirmed', completed: 'done', cancelled: 'cancelled' } as Record<string, string>)[b.status] ?? b.status;
}
