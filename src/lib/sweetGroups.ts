import type { SeasonalItem } from './itemCatalog';

type Occ = { id: string; name: string; is_active: boolean };
type Item = Pick<SeasonalItem, 'id' | 'name' | 'category' | 'occasion_id' | 'is_active'>;

export const ALL = 'all';
export const ALL_YEAR = 'none';

export interface SweetGroup<T extends Item = SeasonalItem> { id: string; title: string; occasion?: Occ; items: T[] }
export interface SweetChip { id: string; label: string; count: number }

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

// "A", "A and B", "A, B and C"
export const andList = (names: string[]) =>
  names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

// Seasons on the counter first, then all-year sweets, then seasons that are off; empty groups are left out.
export function sweetGroups<T extends Item>(items: T[], occasions: Occ[], pick = ALL, term = ''): SweetGroup<T>[] {
  const q = term.trim().toLowerCase();
  const known = new Set(occasions.map(o => o.id));
  const match = (i: T) => !q || i.name.toLowerCase().includes(q) || (i.category ?? '').toLowerCase().includes(q);
  const inGroup = (i: T, id: string) => (id === ALL_YEAR ? !i.occasion_id || !known.has(i.occasion_id) : i.occasion_id === id);
  const order: (Occ | null)[] = [...occasions.filter(o => o.is_active), null, ...occasions.filter(o => !o.is_active)];
  return order
    .map(o => {
      const id = o?.id ?? ALL_YEAR;
      return { id, title: o?.name ?? 'All year', occasion: o ?? undefined, items: items.filter(i => inGroup(i, id) && match(i)) };
    })
    .filter(g => g.items.length > 0 && (pick === ALL || pick === g.id));
}

// Filter chips with counts, in group order.
export const sweetChips = (items: Item[], occasions: Occ[]): SweetChip[] => [
  { id: ALL, label: 'All', count: items.length },
  ...sweetGroups(items, occasions).map(g => ({ id: g.id, label: g.title, count: g.items.length })),
];

// "6 sweets · on the POS", "7 sweets · all hidden after the festival", "7 sweets · 4 on the POS"
export function groupMeta(g: SweetGroup<Item>): string {
  const n = g.items.length;
  const on = g.items.filter(i => i.is_active).length;
  if (on === n) return `${plural(n, 'sweet')} · ${g.occasion ? 'on the POS' : 'always on the POS'}`;
  if (on === 0) return `${plural(n, 'sweet')} · all hidden${g.occasion && !g.occasion.is_active ? ' after the festival' : ''}`;
  return `${plural(n, 'sweet')} · ${on} on the POS`;
}
