import type { MenuCategory, MenuSubcategory } from '../hooks/useMenuBuilder';
import type { Dish } from './menuCatalog';
import type { XCell, XSheet } from './xlsx';
import { FoodStyle, cleanStyles, parseStyles, stylesText } from './foodStyles';
import {
  Answers, Body, BodyRow, Column, Detail, Plan, PlanBuilder, Write, cellOf, claims, countBy, firstRows, fuzzy, matchKey,
  parsePasteList, parseYesNo, plural, priceDecision, readBody, rupees, shapeCounts, skipLabel, textOf,
} from './importPlan';

// Menu import: Excel rows or a pasted list into Menu Builder's categories, subcategories and dishes.

// withStyles is false before the food_styles column exists; the import then leaves food styles alone.
export interface MenuData { cats: MenuCategory[]; subs: MenuSubcategory[]; dishes: Dish[]; withStyles?: boolean }

export const DISH_COLUMNS: Column[] = [
  { key: 'cat', label: 'Category', names: ['category', 'main category', 'cat', 'course', 'menu'] },
  { key: 'sub', label: 'Subcategory', names: ['subcategory', 'sub category', 'subcat', 'sub group', 'section'] },
  { key: 'name', label: 'Dish', names: ['dish', 'dish name', 'item', 'item name', 'name', 'menu item', 'food'], required: true },
  { key: 'price', label: 'Price per plate', names: ['price per plate', 'price', 'rate', 'per plate', 'plate price', 'amount', 'cost'] },
  { key: 'style', label: 'Food style', names: ['food style', 'style', 'food type', 'type'] },
  { key: 'shown', label: 'On quotes', names: ['on quotes', 'show on quotes', 'on quote', 'shown', 'show', 'visible', 'active'] },
];
const ORDER = ['menu_categories', 'menu_subcategories', 'menu_items'];
const yesNo = (b: boolean) => (b ? 'Yes' : 'No');

export const dishTemplate = (): XCell[][] => [DISH_COLUMNS.map(c => c.label), ['Chaat Street', 'Delhi Ki Chaat', 'Raj Kachori', 60, 'Jain', 'Yes']];

// Today's menu in the import columns, by category, subcategory and dish.
export function dishSheet({ cats, subs, dishes }: MenuData): XCell[][] {
  const cat = new Map(cats.map(c => [c.id, c.name]));
  const sub = new Map(subs.map(s => [s.id, s]));
  const rows = dishes.map(d => {
    const s = sub.get(d.subcategory_id);
    return [cat.get(s?.category_id ?? '') ?? '', s?.name ?? '', d.name, Number(d.default_price) > 0 ? Number(d.default_price) : null, stylesText(d.food_styles), yesNo(d.is_active)];
  });
  const by = (r: XCell[]) => r.slice(0, 3).map(v => String(v ?? '').toLowerCase()).join('\u0000');
  return [DISH_COLUMNS.map(c => c.label), ...rows.sort((a, b) => by(a).localeCompare(by(b)))];
}

// "None" clears the styles; an empty or unknown cell leaves them.
function readStyles(text: string): FoodStyle[] | null {
  if (!text) return null;
  if (/^(none|no|nil|-)$/i.test(text)) return [];
  const found = parseStyles(text);
  return found.length ? found : null;
}

type Place =
  | { kind: 'sub'; sub: MenuSubcategory }
  | { kind: 'new'; key: string; catId: string | null; catName: string; subName: string }
  | { kind: 'any' } | { kind: 'wait' } | { kind: 'skip'; why: string };

const SKIPPED: Place = { kind: 'skip', why: 'Skipped' };

// Where each row's category › subcategory lands, asking once per pair when it is not in Menu Builder.
function places(data: MenuData, b: PlanBuilder, counts: Map<string, number>, newId: () => string) {
  const catByKey = new Map(data.cats.map(c => [matchKey(c.name), c]));
  const catName = new Map(data.cats.map(c => [c.id, c.name]));
  const nearCat = fuzzy(data.cats, c => c.name, true);
  const nearSub = fuzzy(data.subs, s => s.name, true);
  const subIn = (catId: string | null, name: string) => data.subs.find(s => (!catId || s.category_id === catId) && matchKey(s.name) === matchKey(name));
  const made = new Map<string, string>();
  const memo = new Map<string, Place>();

  const resolve = (cat: string, sub: string, row: number): Place => {
    const key = `${matchKey(cat)}|${matchKey(sub)}`;
    if (!memo.has(key)) memo.set(key, find(cat, sub, row, key));
    return memo.get(key)!;
  };

  const find = (cat: string, sub: string, row: number, key: string): Place => {
    if (!sub) return { kind: 'any' };
    const n = counts.get(key) ?? 1;
    const ask = (text: string, yes: string, no: string) => b.ask({ id: `place:${key}`, row, text, yes, no });
    const fresh = (catId: string | null): Place => ({ kind: 'new', key, catId, catName: catId ? catName.get(catId) ?? cat : cat, subName: sub });
    const pick = (ok: boolean | undefined, yes: Place, no: Place): Place => (ok === undefined ? { kind: 'wait' } : ok ? yes : no);
    const known = cat ? catByKey.get(matchKey(cat)) : undefined;
    if (known || !cat) {
      const exact = subIn(known?.id ?? null, sub);
      if (exact) return { kind: 'sub', sub: exact };
      const near = nearSub(sub, 0.7, s => !known || s.category_id === known.id);
      if (!known && near) return pick(ask(`Subcategory "${sub}" is not in Menu Builder. Did you mean "${near.name}"?`, `Use ${near.name}`, skipLabel(n)), { kind: 'sub', sub: near }, SKIPPED);
      if (!known) return { kind: 'skip', why: `Subcategory "${sub}" is not in Menu Builder; add a Category column to create it` };
      if (near) return pick(ask(`Subcategory "${sub}" is not in Menu Builder. Did you mean "${near.name}"?`, `Use ${near.name}`, `Create "${sub}"`), { kind: 'sub', sub: near }, fresh(known.id));
      return pick(ask(`Subcategory "${sub}" is new in ${known.name}.`, `Create "${sub}"`, skipLabel(n)), fresh(known.id), SKIPPED);
    }
    const similar = nearCat(cat, 0.7);
    const inside = similar && (subIn(similar.id, sub) ?? nearSub(sub, 0.7, s => s.category_id === similar.id));
    if (similar && inside) return pick(ask(`Category "${cat}" is not in Menu Builder. Did you mean "${similar.name} › ${inside.name}"?`, `Use ${inside.name}`, `Create "${cat}"`), { kind: 'sub', sub: inside }, fresh(null));
    if (similar) return pick(ask(`Category "${cat}" is not in Menu Builder. Did you mean "${similar.name}"?`, `Use ${similar.name}`, `Create "${cat}"`), fresh(similar.id), fresh(null));
    return pick(ask(`"${cat} › ${sub}" is not in Menu Builder yet.`, 'Create it', skipLabel(n)), fresh(null), SKIPPED);
  };

  // Adds the new category and subcategory the first time a dish needs them.
  const subIdOf = (p: Place): string => {
    if (p.kind === 'sub') return p.sub.id;
    if (p.kind !== 'new') return '';
    const catKey = `cat:${matchKey(p.catName)}`;
    let catId = p.catId ?? made.get(catKey);
    if (!catId) { catId = newId(); made.set(catKey, catId); b.insert('menu_categories', catId, { name: p.catName, is_active: true }); }
    let subId = made.get(p.key);
    if (!subId) { subId = newId(); made.set(p.key, subId); b.insert('menu_subcategories', subId, { name: p.subName, category_id: catId, is_active: true }); }
    return subId;
  };

  const subById = new Map(data.subs.map(s => [s.id, s]));
  const atSub = (s?: MenuSubcategory) => (s ? `${catName.get(s.category_id) ?? ''} › ${s.name}` : '');
  const where = (p: Place) => (p.kind === 'sub' ? atSub(p.sub) : p.kind === 'new' ? `${p.catName} › ${p.subName} (new)` : '');
  const subName = (p: Place) => (p.kind === 'sub' ? p.sub.name : p.kind === 'new' ? p.subName : '');
  // "Chaat Street › Delhi Ki Chaat", or "Delhi Ki Chaat → Indori Chaat" for a move.
  const whereOf = (d: Dish, to: Place, moved: boolean) => (moved ? `${subById.get(d.subcategory_id)?.name ?? ''} → ${subName(to)}` : atSub(subById.get(d.subcategory_id)));
  return { resolve, subIdOf, where, whereOf };
}

interface Row { r: BodyRow; name: string; place: Place; dish?: Dish; why?: string }
interface Next { subId: string; price: number | null; styles: FoodStyle[] | null; shown: boolean | null }

// The columns a saved dish changes, with their old values and what the preview shows.
function diffDish(dish: Dish, next: Next) {
  const values: Record<string, unknown> = {};
  const old: Record<string, unknown> = {};
  const details: Detail[] = [];
  const set = (col: 'subcategory_id' | 'default_price' | 'food_styles' | 'is_active', to: unknown, detail?: Detail) => {
    values[col] = to;
    old[col] = dish[col] ?? null;
    if (detail) details.push(detail);
  };
  if (next.subId !== dish.subcategory_id) set('subcategory_id', next.subId);
  if (next.price !== null && next.price !== Number(dish.default_price)) set('default_price', next.price, { label: 'Price', old: rupees(dish.default_price), next: rupees(next.price) });
  const was = cleanStyles(dish.food_styles);
  if (next.styles && stylesText(next.styles) !== stylesText(was)) set('food_styles', next.styles, { label: 'Food style', old: stylesText(was) || 'none', next: stylesText(next.styles) || 'none' });
  if (next.shown !== null && next.shown !== dish.is_active) set('is_active', next.shown, { label: 'On quotes', old: yesNo(dish.is_active), next: yesNo(next.shown) });
  return { values, old, details };
}

export function planDishes(sheets: XSheet[], data: MenuData, answers: Answers, newId: () => string): Plan {
  const body: Body = readBody(sheets, DISH_COLUMNS);
  const b = new PlanBuilder(answers);
  if (body.missing.length) return b.finish(body, ORDER);
  const text = (r: BodyRow, k: string) => textOf(body, r, k);
  const pairKey = (r: BodyRow) => `${matchKey(text(r, 'cat'))}|${matchKey(text(r, 'sub'))}`;
  const counts = countBy(body.rows, pairKey);
  const shapes = shapeCounts(body.rows.map(r => cellOf(body, r, 'price')));
  const where = places(data, b, counts, newId);
  const saved = claims(data.dishes, d => matchKey(d.name));
  const near = fuzzy(data.dishes, d => d.name);
  const copies = countBy(data.dishes, d => `${d.subcategory_id}|${matchKey(d.name)}`);
  const first = firstRows(k => copies.get(k) ?? 0);
  const styled = data.withStyles !== false;

  const rows: Row[] = body.rows.flatMap(r => {
    const name = text(r, 'name');
    if (!name) { b.skip(r.row, '', 'No dish name'); return []; }
    const place = where.resolve(text(r, 'cat'), text(r, 'sub'), r.row);
    const twice = first(`${place.kind === 'sub' ? place.sub.id : pairKey(r)}|${matchKey(name)}`, r.row);
    if (twice) { b.skip(r.row, name, `Listed twice; row ${twice} is used`); return []; }
    return [{ r, name, place }];
  });
  // Same name in its own subcategory first, then anywhere (a move), then a look-alike name after a yes.
  rows.forEach(x => { if (x.place.kind === 'sub') { const sid = x.place.sub.id; x.dish = saved.find(matchKey(x.name), d => d.subcategory_id === sid); if (x.dish) saved.take(x.dish); } });
  rows.forEach(x => { if (!x.dish && x.place.kind !== 'skip') { x.dish = saved.find(matchKey(x.name)); if (x.dish) saved.take(x.dish); } });
  rows.forEach(x => {
    if (x.dish || x.place.kind === 'skip') return;
    const sid = x.place.kind === 'sub' ? x.place.sub.id : null;
    const like = (sid && near(x.name, 0.85, d => saved.free(d) && d.subcategory_id === sid)) || near(x.name, 0.85, saved.free);
    if (!like) return;
    const ok = b.ask({ id: `same:${x.r.row}`, row: x.r.row, text: `"${x.name}" looks like "${like.name}", which is already saved.`, yes: 'Same dish — update it', no: 'Add as new dish' });
    if (ok === undefined) x.why = 'wait';
    else if (ok) x.dish = saved.take(like);
  });

  rows.forEach(({ r, name, place, dish, why }) => {
    if (place.kind === 'skip') { b.skip(r.row, name, place.why); return; }
    const price = priceDecision(b, cellOf(body, r, 'price'), r.row, shapes);
    if (price === 'skip') { b.skip(r.row, name, 'Skipped'); return; }
    if (price === 'wait' || place.kind === 'wait' || why === 'wait') { b.wait(r.row, name, where.where(place)); return; }
    const styles = styled ? readStyles(text(r, 'style')) : null;
    const shown = parseYesNo(cellOf(body, r, 'shown'));
    if (!dish) {
      if (place.kind === 'any') { b.skip(r.row, name, 'Not in Menu Builder and no subcategory given'); return; }
      const subcategory_id = where.subIdOf(place);
      // Every added dish carries the same columns, so one batch insert fills none with null.
      b.insert('menu_items', newId(), { name, subcategory_id, default_price: price, is_active: shown ?? true, ...(styled ? { food_styles: styles ?? [] } : {}) });
      b.change({ row: r.row, tile: 'new', tone: 'new', chip: 'New dish', name, where: where.where(place), details: [{ label: 'Price', old: '—', next: rupees(price) }] });
      return;
    }
    const d = diffDish(dish, { subId: place.kind === 'any' ? dish.subcategory_id : where.subIdOf(place), price, styles, shown });
    b.update('menu_items', dish.id, d.values, d.old);
    const moved = 'subcategory_id' in d.values;
    const hadPrice = Number(dish.default_price) > 0;
    const base = { row: r.row, name: dish.name, where: where.whereOf(dish, place, moved), details: d.details };
    if (moved) b.change({ ...base, tile: 'moved', tone: 'moved', chip: 'Moved' });
    else if ('default_price' in d.values) b.change({ ...base, tile: 'changed', tone: hadPrice ? 'changed' : 'added', chip: hadPrice ? 'Price changed' : 'Price added' });
    else if (d.details.length) b.change({ ...base, tile: 'other', tone: 'other', chip: 'Updated' });
    else b.change({ ...base, tile: 'same', tone: 'same', chip: 'Same', details: [{ label: 'Price', old: '', next: rupees(dish.default_price) }] });
  });
  return b.finish(body, ORDER);
}

// ─── Paste a list into one subcategory ───────────────────────────────────────
export type PasteKind = 'new' | 'price' | 'same' | 'twice';
export interface PasteRow { line: number; kind: PasteKind; name: string; price: number | null; old: number | null; dishId?: string }

// Each pasted line against the subcategory's dishes, matched the same way as an Excel import.
export function planPaste(text: string, subId: string, dishes: Dish[]): PasteRow[] {
  const known = new Set(dishes.map(d => matchKey(d.name)));
  const saved = claims(dishes.filter(d => d.subcategory_id === subId), d => matchKey(d.name));
  const first = firstRows();
  return parsePasteList(text).map(l => {
    // "Paneer 65" is a dish, not Paneer at ₹65.
    const read = l.price !== null && known.has(matchKey(l.whole)) && !known.has(matchKey(l.name)) ? { name: l.whole, price: null } : l;
    const base = { line: l.line, name: read.name, price: read.price, old: null };
    if (first(matchKey(read.name), l.line)) return { ...base, kind: 'twice' as const };
    const dish = saved.find(matchKey(read.name));
    if (!dish) return { ...base, kind: 'new' as const };
    saved.take(dish);
    const old = Number(dish.default_price) > 0 ? Number(dish.default_price) : null;
    const kind: PasteKind = read.price !== null && read.price !== old ? 'price' : 'same';
    return { ...base, name: dish.name, old, kind, dishId: dish.id };
  });
}

export function pasteWrites(rows: PasteRow[], subId: string, newId: () => string): Write[] {
  return [
    ...rows.filter(r => r.kind === 'new').map(r => {
      const id = newId();
      return { table: 'menu_items', id, values: { id, name: r.name, subcategory_id: subId, default_price: r.price, is_active: true } };
    }),
    ...rows.filter(r => r.kind === 'price' && r.dishId).map(r => ({ table: 'menu_items', id: r.dishId!, values: { default_price: r.price }, old: { default_price: r.old } })),
  ];
}

// "5 new · 1 price update"
export function pasteSummary(rows: PasteRow[]): string {
  const n = rows.filter(r => r.kind === 'new').length;
  const u = rows.filter(r => r.kind === 'price').length;
  return [n ? `${n} new` : '', u ? plural(u, 'price update') : ''].filter(Boolean).join(' · ') || 'Nothing new to add';
}
