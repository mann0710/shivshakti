import type { EventDay, MealSlot, Quotation, QuoteRevision } from '../hooks/useQuotations';
import { dishCount } from './quoteChoices';
import { sumCharges } from './quoteMath';
import { mealTitle } from './docs/menu';
import { formatDateIST } from './ist';
import { inr } from './money';

// The fields a revision keeps and restores: menu, prices, guests, charges and what prints.
export const REVISED = ['is_multi_day', 'items', 'event_days', 'per_plate_amount', 'per_plate_max', 'guest_count', 'subtotal', 'discount_amount',
  'gst_rate', 'gst_amount', 'total_amount', 'total_max', 'extra_charges', 'transportation_charges', 'additional_discounts',
  'full_price', 'hide_discount', 'notes', 'food_type'] as const;

// The booking fields a quote edit also writes, kept so Undo puts the booking back too.
export const BOOKED = ['event_type', 'event_date', 'end_date', 'event_time', 'venue', 'guest_count'] as const;
const pick = (o: object | null | undefined, keys: readonly string[]) => Object.fromEntries(keys.filter(k => o && k in o).map(k => [k, (o as Record<string, unknown>)[k]]));

export const snapshotOf = (q: Quotation, at: string): QuoteRevision => ({
  n: (q.revisions?.length ?? 0) + 1, at, total: q.total_amount, quote: pick(q, REVISED), booking: pick(q.booking, BOOKED),
});

// True when the quote (and its booking) still read exactly as the kept version.
export const sameAsRevision = (v: QuoteRevision, q: Quotation) =>
  JSON.stringify(pick(q, Object.keys(v.quote))) === JSON.stringify(v.quote) && !revisionChanges({ ...(v.quote as Partial<Quotation>), booking: v.booking as Quotation['booking'] }, q).length;

const priceAndGuests = (name: string, a: { guest_count?: number; per_plate_amount?: number; items?: MealSlot['items'] }, b: typeof a, out: string[]) => {
  if ((a.guest_count ?? 0) !== (b.guest_count ?? 0)) out.push(`${name} · ${a.guest_count ?? 0} → ${b.guest_count ?? 0} guests`);
  if ((a.per_plate_amount ?? 0) !== (b.per_plate_amount ?? 0)) out.push(`${name} · ${inr(a.per_plate_amount ?? 0)} → ${inr(b.per_plate_amount ?? 0)} a plate`);
  if (dishCount(a.items) !== dishCount(b.items)) out.push(`${name} · ${dishCount(a.items)} → ${dishCount(b.items)} dishes`);
};

// "What changed" between the accepted version and now, meal by meal, then charges and discounts.
export function revisionChanges(before: Partial<Quotation>, after: Quotation): string[] {
  const out: string[] = [];
  if (after.is_multi_day) {
    const was = new Map(((before.event_days ?? []) as EventDay[]).flatMap(d => d.meals.map(m => [m.id, m] as [string, MealSlot])));
    for (const d of after.event_days ?? []) for (const m of d.meals) {
      const name = `${d.date ? `${formatDateIST(d.date, 'EEE d MMM')} ` : ''}${mealTitle(m)}`;
      const o = was.get(m.id);
      if (!o) { out.push(`${name} · added`); continue; }
      was.delete(m.id);
      priceAndGuests(name, o, m, out);
    }
    was.forEach(m => out.push(`${mealTitle(m)} · removed`));
  } else priceAndGuests('The meal', before, after, out);
  const b0 = (before.booking ?? {}) as Record<string, string>;
  const b1 = (after.booking ?? {}) as Record<string, string>;
  const fmt = (k: string, v: string) => (!v ? '—' : k === 'event_date' ? formatDateIST(v, 'd MMM') : k === 'event_time' ? v.slice(0, 5) : v);
  ([['event_type', 'Event'], ['event_date', 'Date'], ['event_time', 'Time'], ['venue', 'Venue']] as const).forEach(([k, label]) => {
    if (before.booking && (b0[k] || '').slice(0, k === 'event_time' ? 5 : 99) !== (b1[k] || '').slice(0, k === 'event_time' ? 5 : 99)) out.push(`${label} · ${fmt(k, b0[k])} → ${fmt(k, b1[k])}`);
  });
  const charges = (q: Partial<Quotation>) => sumCharges(q.extra_charges) + sumCharges(q.transportation_charges);
  if (charges(before) !== charges(after)) out.push(`Extras and transport · ${inr(charges(before))} → ${inr(charges(after))}`);
  const off = (q: Partial<Quotation>) => sumCharges(q.additional_discounts);
  if (off(before) !== off(after)) out.push(`Discount on the total · ${inr(off(before))} → ${inr(off(after))}`);
  return out;
}
