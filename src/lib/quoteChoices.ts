import type { QuotationLineItem, ChoiceMeta, EventDay, Quotation, QuotationPayload } from '../hooks/useQuotations';
import { quoteTotals, sumCharges } from './quoteMath';

// "Choose any N of M" groups live on the dishes themselves (item.choice), so they work in any menu or meal.
export interface ChoiceGroup { meta: ChoiceMeta; items: QuotationLineItem[] }

export const newChoiceId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const amt = (i: QuotationLineItem) => Number(i.amount) || 0;
const sum = (l: QuotationLineItem[]) => l.reduce((s, i) => s + amt(i), 0);

export function choiceGroups(items: QuotationLineItem[] | undefined): ChoiceGroup[] {
  const out: ChoiceGroup[] = [];
  for (const it of items ?? []) {
    if (!it.choice) continue;
    let g = out.find(x => x.meta.id === it.choice!.id);
    if (!g) { g = { meta: it.choice, items: [] }; out.push(g); }
    g.items.push(it);
  }
  return out;
}

export const pickedOf = (g: ChoiceGroup) => g.items.filter(i => i.chosen);
export const hasOpenChoices = (items: QuotationLineItem[] | undefined) => choiceGroups(items).some(g => !pickedOf(g).length);

// Plate price from dish prices: fixed dishes plus each priced group's cheapest..dearest picks (or what was picked).
export function plateRange(items: QuotationLineItem[] | undefined): { min: number; max: number } {
  const list = items ?? [];
  let min = sum(list.filter(i => !i.choice));
  let max = min;
  for (const g of choiceGroups(list)) {
    if (g.meta.included) continue;
    const picked = pickedOf(g);
    if (picked.length) { min += sum(picked); max += sum(picked); continue; }
    const a = g.items.map(amt).sort((x, y) => x - y);
    const n = Math.min(Math.max(1, g.meta.pick), a.length);
    min += a.slice(0, n).reduce((s, x) => s + x, 0);
    max += a.slice(a.length - n).reduce((s, x) => s + x, 0);
  }
  return { min, max };
}

// What is actually served: only the picked dishes of groups the customer has decided.
export const servedItems = (items: QuotationLineItem[] | undefined) => {
  const decided = new Set(choiceGroups(items).filter(g => pickedOf(g).length).map(g => g.meta.id));
  return (items ?? []).filter(i => !i.choice || !decided.has(i.choice.id) || i.chosen);
};

// ── editing helpers (return new arrays) ──
export const setGroupMeta = (items: QuotationLineItem[], id: string, patch: Partial<ChoiceMeta>) =>
  items.map(i => (i.choice?.id === id ? { ...i, choice: { ...i.choice, ...patch } } : i));
export const assignGroup = (items: QuotationLineItem[], itemId: string, meta: ChoiceMeta | null) =>
  items.map(i => (i.item_id === itemId ? { ...i, choice: meta ?? undefined, chosen: undefined } : i));
export const ungroup = (items: QuotationLineItem[], id: string) =>
  items.map(i => (i.choice?.id === id ? { ...i, choice: undefined, chosen: undefined } : i));

// A group needs two dishes; one left over goes back to a normal dish, and "choose N" never exceeds the dishes.
export function tidyGroups(items: QuotationLineItem[]): QuotationLineItem[] {
  const sizes = new Map(choiceGroups(items).map(g => [g.meta.id, g.items.length]));
  return items.map(i => {
    if (!i.choice) return i;
    const n = sizes.get(i.choice.id) ?? 0;
    if (n < 2) return { ...i, choice: undefined, chosen: undefined };
    return i.choice.pick > n ? { ...i, choice: { ...i.choice, pick: n } } : i;
  });
}

// Puts `alt` beside the target dish (or into the target group) as an alternative; `alt` may already be in the menu.
export function addAlternative(items: QuotationLineItem[], target: { itemId?: string; groupId?: string }, alt: QuotationLineItem): QuotationLineItem[] {
  let meta = target.groupId ? items.find(i => i.choice?.id === target.groupId)?.choice : undefined;
  let next = items.filter(i => i.item_id !== alt.item_id);
  if (!meta) {
    const base = items.find(i => i.item_id === target.itemId);
    if (!base || base.item_id === alt.item_id) return items;
    meta = base.choice ?? { id: newChoiceId(), label: base.subcategory_name || base.category_name || 'Choice', pick: 1 };
    next = next.map(i => (i.item_id === base.item_id ? { ...i, choice: meta, chosen: undefined } : i));
  }
  const at = next.reduce((last, i, idx) => (i.choice?.id === meta!.id ? idx : last), -1);
  const moved = { ...(items.find(i => i.item_id === alt.item_id) ?? alt), choice: meta, chosen: undefined };
  return tidyGroups([...next.slice(0, at + 1), moved, ...next.slice(at + 1)]);
}

// Ticks what the customer picked; "choose 1" switches the pick, larger groups stop at their number.
export function togglePicked(items: QuotationLineItem[], itemId: string): QuotationLineItem[] {
  const it = items.find(i => i.item_id === itemId);
  const g = it?.choice && choiceGroups(items).find(x => x.meta.id === it.choice!.id);
  if (!it || !g) return items;
  if (it.chosen) return items.map(i => (i.item_id === itemId ? { ...i, chosen: undefined } : i));
  const single = g.meta.pick <= 1;
  if (!single && pickedOf(g).length >= g.meta.pick) return items;
  return items.map(i => (i.item_id === itemId ? { ...i, chosen: true } : single && i.choice?.id === g.meta.id ? { ...i, chosen: undefined } : i));
}

// Key of a dish within a quote: meal id (multi-day) + item id.
export const pickKey = (itemId: string, mealId = '') => `${mealId}:${itemId}`;
const withPicks = (items: QuotationLineItem[], picked: Set<string>, mealId = '') =>
  items.map(i => (i.choice ? { ...i, chosen: picked.has(pickKey(i.item_id, mealId)) } : i));

// Meals priced at their dearest picks, for the top of a price range.
export const atMaxPrices = (days: EventDay[]) => days.map(d => {
  const meals = d.meals.map(m => {
    const pp = m.per_plate_max ?? m.per_plate_amount;
    return { ...m, per_plate_amount: pp, subtotal: pp * m.guest_count };
  });
  return { ...d, meals, day_subtotal: meals.reduce((s, m) => s + m.subtotal, 0) };
});

// Saved quote → the changes that lock in the customer's picks (and final guests for single-day).
export function acceptPatch(q: Quotation, picked: Set<string>, guests?: number): Partial<QuotationPayload> {
  const base = { gstRate: q.gst_rate || 0, extra: sumCharges(q.extra_charges), transport: sumCharges(q.transportation_charges) };
  if (q.is_multi_day && q.event_days?.length) {
    const event_days = q.event_days.map(d => {
      const meals = d.meals.map(m => {
        const items = withPicks(m.items ?? [], picked, m.id);
        const pp = m.per_plate_max != null ? plateRange(items).min : m.per_plate_amount;
        return { ...m, items, per_plate_amount: pp, per_plate_max: null, subtotal: pp * m.guest_count };
      });
      return { ...d, meals, day_subtotal: meals.reduce((s, m) => s + m.subtotal, 0) };
    });
    const t = quoteTotals({ ...base, isMultiDay: true, eventDays: event_days, perPlate: 0, guests: 0, additional: q.additional_discounts ?? [] });
    return { event_days, subtotal: t.subtotal, discount_amount: t.discount, gst_amount: t.gst, total_amount: t.final, per_plate_max: null, total_max: null };
  }
  const items = withPicks(q.items ?? [], picked);
  const g = guests ?? q.guest_count;
  const pp = q.per_plate_max != null ? plateRange(items).min : q.per_plate_amount;
  const additional = q.additional_discounts?.length ? q.additional_discounts : q.discount_amount > 0 ? [{ amount: q.discount_amount }] : [];
  const t = quoteTotals({ ...base, isMultiDay: false, eventDays: [], perPlate: pp, guests: g, additional });
  return { items, per_plate_amount: pp, guest_count: g, subtotal: t.subtotal, discount_amount: t.discount, gst_amount: t.gst, total_amount: t.final, per_plate_max: null, total_max: null };
}

// Every dish of a quote with its meal id (single-day dishes have none).
export const quoteDishes = (q: Pick<Quotation, 'is_multi_day' | 'event_days' | 'items'>) =>
  q.is_multi_day && q.event_days?.length
    ? q.event_days.flatMap(d => d.meals.flatMap(m => (m.items ?? []).map(item => ({ item, mealId: m.id, meal: m }))))
    : (q.items ?? []).map(item => ({ item, mealId: '', meal: undefined }));
