import { inr } from './money';

// Recycle bin: what each deleted row is called, which rows came out together, and how to put one back.

export interface BinEntry { id: string; kind: string; row_id: string | null; label: string; data: Record<string, any>; deleted_at: string; deleted_by?: string | null }
// An Excel import's undo: put `values` back on a row it changed, or remove a row it added (no `values`).
export interface UndoStep { table: string; id: string; values?: Record<string, unknown> }
export interface BinGroup { entry: BinEntry; children: BinEntry[] }
export interface RestorePlan { steps: { table: string; values: Record<string, any>; binId: string }[]; problem?: string }
export type Ref = { table: string; id: string };

export const KEEP_DAYS = 30;
export const IMPORT_DAYS = 7;
const SAME_ACTION_MS = 2 * 60 * 1000;
const DAY_MS = 86400000;

export const KIND_NAME: Record<string, string> = {
  customers: 'Customer', seasonal_customers: 'Sweets customer', bookings: 'Booking', quotations: 'Quotation', menus: 'Package',
  menu_categories: 'Menu category', menu_subcategories: 'Menu subcategory', menu_items: 'Dish', seasonal_items: 'Sweet',
  seasonal_preorders: 'Pre-booking', import: 'Bulk change',
};

// [link column, parent table, needed]: a needed parent must exist; an optional one is cleared when it is gone.
const PARENTS: Record<string, [string, string, boolean][]> = {
  menu_items: [['subcategory_id', 'menu_subcategories', true]],
  menu_subcategories: [['category_id', 'menu_categories', true]],
  quotations: [['customer_id', 'customers', true], ['booking_id', 'bookings', false]],
  bookings: [['customer_id', 'customers', true], ['menu_id', 'menus', false]],
  seasonal_items: [['occasion_id', 'seasonal_occasions', false]],
  seasonal_preorders: [['occasion_id', 'seasonal_occasions', false]],
};
const PARENT_OF = new Map(Object.entries(PARENTS).flatMap(([child, list]) => list.map(([col, parent]) => [`${parent}>${child}`, col] as const)));

const at = (e: BinEntry) => new Date(e.deleted_at).getTime();
const sameAction = (a: BinEntry, b: BinEntry) => Math.abs(at(a) - at(b)) <= SAME_ACTION_MS;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// True when `child` was deleted along with `parent` (a cascade or one action).
const childOf = (child: BinEntry, parent: BinEntry) => {
  const col = PARENT_OF.get(`${parent.kind}>${child.kind}`);
  return !!col && !!parent.row_id && child.data?.[col] === parent.row_id && sameAction(child, parent);
};

// Everything deleted along with `parent`, children before grandchildren.
export const descendants = (parent: BinEntry, bin: BinEntry[]): BinEntry[] =>
  bin.filter(c => c.id !== parent.id && childOf(c, parent)).flatMap(c => [c, ...descendants(c, bin)]);

// Top-level entries, newest first, each with everything that was deleted along with it.
export function groupBin(entries: BinEntry[]): BinGroup[] {
  const sorted = [...entries].sort((a, b) => at(b) - at(a));
  const nested = new Set(sorted.flatMap(p => sorted.filter(c => c.id !== p.id && childOf(c, p)).map(c => c.id)));
  return sorted.filter(e => !nested.has(e.id)).map(entry => ({ entry, children: descendants(entry, sorted) }));
}

// "with 2 subcategories and 31 dishes"
export function childNote(children: BinEntry[]): string {
  const count = (k: string) => children.filter(c => c.kind === k).length;
  const parts = [
    count('menu_subcategories') && plural(count('menu_subcategories'), 'subcategory', 'subcategories'),
    count('menu_items') && plural(count('menu_items'), 'dish', 'dishes'),
    count('quotations') && plural(count('quotations'), 'quotation'),
  ].filter(Boolean);
  return parts.length ? `with ${parts.join(' and ')}` : '';
}

const day = (iso?: string) => (iso ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

// Title and one detail line for a bin row.
export function binText(e: BinEntry): { title: string; line: string } {
  const d = e.data ?? {};
  const kind = KIND_NAME[e.kind] ?? e.kind;
  switch (e.kind) {
    case 'customers': case 'seasonal_customers': return { title: d.name || e.label, line: [kind, d.phone].filter(Boolean).join(' · ') };
    case 'quotations': return { title: d.quotation_number || e.label, line: [kind, d.total_amount ? inr(Number(d.total_amount)) : '', day(d.issue_date)].filter(Boolean).join(' · ') };
    case 'bookings': return { title: `${d.event_type || 'Event'} on ${day(d.event_date)}`, line: [kind, d.guest_count ? `${d.guest_count} guests` : '', d.venue].filter(Boolean).join(' · ') };
    case 'menu_items': return { title: d.name || e.label, line: [kind, Number(d.default_price) > 0 ? `${inr(Number(d.default_price))} a plate` : ''].filter(Boolean).join(' · ') };
    case 'menus': return { title: d.name || e.label, line: [kind, Number(d.price_per_plate) > 0 ? `${inr(Number(d.price_per_plate))} a plate` : ''].filter(Boolean).join(' · ') };
    case 'seasonal_preorders': return { title: d.customer_name || e.label, line: [kind, d.delivery_date ? `for ${day(d.delivery_date)}` : '', d.total_amount ? inr(Number(d.total_amount)) : ''].filter(Boolean).join(' · ') };
    case 'import': return { title: e.label || 'Bulk change', line: 'Undo puts the old values back' };
    default: return { title: d.name || e.label || kind, line: kind };
  }
}

// Days until the entry is cleared for good (imports keep 7 days, the rest 30).
export const daysLeft = (e: BinEntry, now = Date.now()) => Math.max(0, Math.ceil(((e.kind === 'import' ? IMPORT_DAYS : KEEP_DAYS) * DAY_MS - (now - at(e))) / DAY_MS));
export const expired = (e: BinEntry, now = Date.now()) => daysLeft(e, now) <= 0;

const newest = (bin: BinEntry[], table: string, id: string) => bin.filter(b => b.kind === table && b.row_id === id).sort((a, b) => at(b) - at(a))[0];

// Every parent row the restore would rely on, through the bin; the caller checks which still exist.
export function parentRefs(entry: BinEntry, bin: BinEntry[], seen = new Set<string>()): Ref[] {
  if (seen.has(entry.id)) return [];
  seen.add(entry.id);
  return (PARENTS[entry.kind] ?? []).flatMap(([col, table]) => {
    const id = entry.data?.[col];
    if (!id) return [];
    const inBin = newest(bin, table, id);
    return [{ table, id }, ...(inBin ? parentRefs(inBin, bin, seen) : [])];
  });
}

// Parents first (from the bin when they were deleted too), then the row, then what was deleted along with it.
export function restorePlan(entry: BinEntry, bin: BinEntry[], exists: (r: Ref) => boolean): RestorePlan {
  const steps: RestorePlan['steps'] = [];
  const planned = new Set<string>();
  let problem: string | undefined;
  const add = (e: BinEntry) => {
    if (problem || planned.has(e.id)) return;
    planned.add(e.id);
    const values = { ...e.data };
    for (const [col, table, needed] of PARENTS[e.kind] ?? []) {
      const id = values[col];
      if (!id || exists({ table, id })) continue;
      const parent = newest(bin, table, id);
      if (parent) add(parent);
      else if (needed) { problem = `Its ${(KIND_NAME[table] ?? table).toLowerCase()} is gone for good, so this can't come back.`; return; }
      else values[col] = null;
    }
    if (!problem) steps.push({ table: e.kind, values, binId: e.id });
  };
  add(entry);
  descendants(entry, bin).forEach(add);
  return problem ? { steps: [], problem } : { steps };
}
