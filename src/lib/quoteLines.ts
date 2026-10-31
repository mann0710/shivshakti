import type { QuotationLineItem } from '../hooks/useQuotations';

// Menu Builder items as the quote editor sees them, and helpers for the dish list.
export interface PickerItem {
  id: string;
  name: string;
  default_price?: number | null;
  subcategory?: { name: string; category?: { name: string } | null } | null;
}

export interface Charge { description: string; amount: number }
export type Discount = Charge & { id: string };

export const genId = () => Math.random().toString(36).slice(2, 10);

export const lineOf = (it: PickerItem, amount: number): QuotationLineItem => ({
  item_id: it.id, item_name: it.name, category_name: it.subcategory?.category?.name || '',
  subcategory_name: it.subcategory?.name || '', amount,
});

// Adds dishes that are not in the menu yet, or starts the menu again from them.
export const mergeLines = (cur: QuotationLineItem[], add: QuotationLineItem[], replace: boolean): QuotationLineItem[] =>
  (replace ? add : [...cur, ...add.filter(a => !cur.some(c => c.item_id === a.item_id))]);

export const moveLine = <T,>(list: T[], from: number, to: number): T[] => {
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
};

// Dishes matching the typed name or course, skipping ones already used; names that start with it first.
export function searchDishes(menu: PickerItem[], term: string, skip: Set<string>, limit = 8): PickerItem[] {
  const t = term.trim().toLowerCase();
  if (!t) return [];
  const hay = (m: PickerItem) => `${m.name} ${m.subcategory?.name ?? ''} ${m.subcategory?.category?.name ?? ''}`.toLowerCase();
  return menu.filter(m => !skip.has(m.id) && hay(m).includes(t))
    .sort((a, b) => Number(b.name.toLowerCase().startsWith(t)) - Number(a.name.toLowerCase().startsWith(t)) || a.name.localeCompare(b.name))
    .slice(0, limit);
}
