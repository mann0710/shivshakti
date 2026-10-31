import type { MenuCategory, MenuItem, MenuSubcategory } from '../hooks/useMenuBuilder';

// Menu Builder's category tree, dish filters and the package helpers that look dishes up in it.

export type Dish = MenuItem & { subcategory?: MenuSubcategory & { category?: MenuCategory } };
export interface SubNode { sub: MenuSubcategory; count: number }
export interface CatNode { cat: MenuCategory; count: number; subs: SubNode[] }
export interface DishFilter { catId?: string | null; subId?: string | null; query?: string; showHidden?: boolean; noPrice?: boolean }

const key = (s: string) => s.trim().toLowerCase();
const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
const visible = (d: Dish, showHidden?: boolean) => showHidden || d.is_active;

// Categories and their subcategories, largest first, with dish counts.
export function buildTree(cats: MenuCategory[], subs: MenuSubcategory[], dishes: Dish[], showHidden = false): CatNode[] {
  const perSub = new Map<string, number>();
  dishes.filter(d => visible(d, showHidden)).forEach(d => perSub.set(d.subcategory_id, (perSub.get(d.subcategory_id) ?? 0) + 1));
  return cats
    .filter(c => showHidden || c.is_active)
    .map(cat => {
      const mine = subs.filter(s => s.category_id === cat.id && (showHidden || s.is_active))
        .map(sub => ({ sub, count: perSub.get(sub.id) ?? 0 }))
        .sort((a, b) => b.count - a.count || byName(a.sub, b.sub));
      return { cat, subs: mine, count: mine.reduce((t, s) => t + s.count, 0) };
    })
    .sort((a, b) => b.count - a.count || byName(a.cat, b.cat));
}

// A search looks through every dish, subcategory and category; otherwise the picked category or subcategory.
export function filterDishes(dishes: Dish[], f: DishFilter): Dish[] {
  const q = key(f.query ?? '');
  return dishes.filter(d => {
    if (!visible(d, f.showHidden)) return false;
    if (f.noPrice && Number(d.default_price) > 0) return false;
    if (q) return [d.name, d.subcategory?.name ?? '', d.subcategory?.category?.name ?? ''].some(s => key(s).includes(q));
    if (f.subId) return d.subcategory_id === f.subId;
    if (f.catId) return d.subcategory?.category_id === f.catId;
    return !!f.noPrice;
  }).sort(byName);
}

export const withoutPrice = (dishes: Dish[]) => dishes.filter(d => d.is_active && !(Number(d.default_price) > 0)).length;

export const placeOf = (d: Dish) => [d.subcategory?.category?.name, d.subcategory?.name].filter(Boolean).join(' › ');

// Where each dish name lives in Menu Builder, for a package's dish list.
export const placesByName = (dishes: Dish[]) => {
  const out = new Map<string, string>();
  dishes.filter(d => d.is_active).forEach(d => { if (!out.has(key(d.name))) out.set(key(d.name), placeOf(d)); });
  return out;
};
export const placeFor = (places: Map<string, string>, name: string) => places.get(key(name));

// Adds a dish once, ignoring case and spaces.
export const addDish = (list: string[], name: string) => {
  const n = name.trim();
  return !n || list.some(x => key(x) === key(n)) ? list : [...list, n];
};

// "Besic (copy)", then "Besic (copy 2)" and so on.
export function copyName(name: string, taken: string[]): string {
  const base = name.replace(/\s*\(copy(?: \d+)?\)$/, '');
  const used = new Set(taken.map(key));
  for (let i = 1; ; i++) {
    const n = `${base} (copy${i > 1 ? ` ${i}` : ''})`;
    if (!used.has(key(n))) return n;
  }
}

// A package line is a Menu Builder dish, or a course like "Sabji 2(Gujarati)": name, how many, and a note.
export interface PlateRow { text: string; name: string; count: number | null; extra: string; place: string | null; group: string | null }
export interface GroupRef { label: string; name: string; count: number }

export const groupsOf = (tree: CatNode[]): GroupRef[] => tree.flatMap(c => [
  { label: `${c.cat.name} · ${plural(c.count, 'dish', 'dishes')}`, name: c.cat.name, count: c.count },
  ...c.subs.map(s => ({ label: `${c.cat.name} › ${s.sub.name} · ${plural(s.count, 'dish', 'dishes')}`, name: s.sub.name, count: s.count })),
]);

const words = (s: string) => key(s).split(/[^a-z]+/).filter(Boolean);
const sameWord = (a: string, b: string) => a === b || `${a}s` === b || a === `${b}s`;

// Category or subcategory a course is picked from: the same name first, then a shared word.
export function matchGroup(name: string, groups: GroupRef[]): GroupRef | undefined {
  const k = key(name);
  const w = words(name);
  return groups.find(g => key(g.name) === k)
    ?? groups.filter(g => g.count > 0).find(g => words(g.name).some(x => w.some(y => sameWord(x, y))));
}

export function plateRow(text: string, places: Map<string, string>, groups: GroupRef[]): PlateRow {
  const place = placeFor(places, text) ?? null;
  const m = place ? null : text.trim().match(/^(.*?)\s*(\d{1,2})\s*(\(.*\))?$/);
  const name = (m?.[1] || text).trim();
  return { text, name, count: place ? null : m ? Number(m[2]) : 1, extra: m?.[3] ?? '', place, group: place ? null : matchGroup(name, groups)?.label ?? null };
}

export const withCount = (r: PlateRow, n: number) => `${r.name} ${n}${r.extra}`;

// "8 courses · 9 dishes" for a package card.
export function plateSummary(rows: PlateRow[]): string {
  const courses = rows.filter(r => r.count !== null);
  const total = rows.reduce((t, r) => t + (r.count ?? 1), 0);
  return [courses.length ? plural(courses.length, 'course') : '', total ? plural(total, 'dish', 'dishes') : 'No dishes yet'].filter(Boolean).join(' · ');
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-IN')} ${n === 1 ? one : many}`;
