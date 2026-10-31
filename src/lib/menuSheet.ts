import { FoodStyle, cleanStyles, parseStyles, stylesText } from './foodStyles';
import { parseAmount, parseYesNo } from './importPlan';
import { Dish, plural } from './menuCatalog';
import { inr } from './money';
import type { UndoStep } from './recycleBin';

// "Edit as sheet": one subcategory's dishes as text cells, with changes kept aside until Review & save.

export const COLS = ['name', 'price', 'styles', 'shown'] as const;
export type Col = typeof COLS[number];
export type Field = Col | 'sub';
export interface SheetRow { id: string; name: string; price: string; styles: FoodStyle[]; shown: boolean; sub: string }
export type RowEdit = Partial<Omit<SheetRow, 'id'>>;
export type Edits = Record<string, RowEdit>;
export interface Change { id: string; dish: string; field: Field; from: string; to: string }
export type CellErrors = Record<string, Partial<Record<'name' | 'price', string>>>;
export interface SaveItem { id: string; patch: Record<string, unknown> }

export const FIELD_LABEL: Record<Field, string> = { name: 'Dish name', price: 'Price / plate', styles: 'Food style', shown: 'On quotes', sub: 'Moved to' };

const key = (s: string) => s.trim().toLowerCase();
export const priceText = (n?: number | null) => (Number(n) > 0 ? String(Number(n)) : '');

export const rowOf = (d: Dish): SheetRow => ({
  id: d.id, name: d.name, price: priceText(d.default_price), styles: cleanStyles(d.food_styles), shown: d.is_active, sub: d.subcategory_id,
});

// "Rs. 1,200/-" → "1200": what Excel and WhatsApp lists usually hold (same reading as Excel imports).
export const cleanPrice = (text: string) => {
  const a = parseAmount(text);
  return a.kind === 'ok' || a.kind === 'messy' ? String(a.value) : text.trim();
};

// Empty clears the price; anything else must be one number above 0.
export function readPrice(text: string): { ok: boolean; value: number | null; error?: string } {
  const a = parseAmount(text);
  if (a.kind === 'empty') return { ok: true, value: null };
  if (a.kind === 'bad') return { ok: false, value: null, error: 'Numbers only' };
  return a.value > 0 ? { ok: true, value: a.value } : { ok: false, value: null, error: 'Above ₹0, or leave empty' };
}

// Hidden / Shown typed or pasted in many ways; null when it means neither.
export const parseShown = (text: string) => parseYesNo(text);

export function same<F extends Field>(field: F, a: SheetRow[F], b: SheetRow[F]): boolean {
  if (field === 'name') return (a as string).trim() === (b as string).trim();
  if (field === 'price') {
    const [x, y] = [readPrice(a as string), readPrice(b as string)];
    return x.ok && y.ok ? x.value === y.value : a === b;
  }
  if (field === 'styles') return cleanStyles(a as string[]).join() === cleanStyles(b as string[]).join();
  return a === b;
}

export const merged = (base: SheetRow, edits: Edits): SheetRow => ({ ...base, ...edits[base.id] });

const FIELD_ORDER: Field[] = ['name', 'price', 'styles', 'shown', 'sub'];
// Fields that really differ: "55.0" for 55 or a trailing space is no change.
export const changedFields = (base: SheetRow, e?: RowEdit): Field[] =>
  e ? FIELD_ORDER.filter(f => f in e && !same(f, base[f], e[f] as SheetRow[Field])) : [];

// Sets one cell; typing the saved text back drops the change (kept while typing "55." so the box keeps its text).
export function setCell<F extends Field>(edits: Edits, base: SheetRow, field: F, value: SheetRow[F]): Edits {
  const row: RowEdit = { ...edits[base.id] };
  if (Array.isArray(value) ? same(field, base[field], value) : base[field] === value) delete row[field];
  else row[field] = value;
  const next = { ...edits };
  if (Object.keys(row).length) next[base.id] = row;
  else delete next[base.id];
  return next;
}

// Same field on many rows; `valueOf` returns undefined to leave a row as is.
export function setMany<F extends Field>(edits: Edits, bases: SheetRow[], field: F, valueOf: (cur: SheetRow) => SheetRow[F] | undefined): Edits {
  return bases.reduce((acc, b) => {
    const v = valueOf(merged(b, acc));
    return v === undefined ? acc : setCell(acc, b, field, v);
  }, edits);
}

// Whole rupees, never below ₹1: +10% on ₹55 is ₹61.
export const pctPrice = (price: number, pct: number) => Math.max(1, Math.round((price * (100 + pct)) / 100));

export const toggleStyle = (list: FoodStyle[], s: FoodStyle): FoodStyle[] => (list.includes(s) ? list.filter(x => x !== s) : cleanStyles([...list, s]));

// Each style: true adds, false removes, undefined leaves it as is.
export const applyStyles = (styles: FoodStyle[], choice: Partial<Record<FoodStyle, boolean>>): FoodStyle[] =>
  cleanStyles([...styles.filter(s => choice[s] !== false), ...Object.keys(choice).filter(s => choice[s as FoodStyle])]);

export function cellText(field: Field, value: SheetRow[Field], subName: (id: string) => string = id => id): string {
  switch (field) {
    case 'name': return (value as string).trim() ? `"${(value as string).trim()}"` : 'empty';
    case 'price': { const p = readPrice(value as string); return p.ok ? (p.value ? inr(p.value) : 'empty') : String(value); }
    case 'styles': return stylesText(value as string[]) || 'none';
    case 'shown': return value ? 'Shown' : 'Hidden';
    default: return subName(value as string);
  }
}

export const wasText = (field: Field, value: SheetRow[Field], subName?: (id: string) => string) => `was ${cellText(field, value, subName)}`;

export function changesOf(bases: SheetRow[], edits: Edits, subName?: (id: string) => string): Change[] {
  return bases.flatMap(b => changedFields(b, edits[b.id]).map(f => ({
    id: b.id, dish: b.name, field: f, from: cellText(f, b[f], subName), to: cellText(f, edits[b.id][f] as SheetRow[Field], subName),
  })));
}

// "5 prices, 1 name, 2 hidden"
export function summary(changes: Change[]): string {
  const count = (test: (c: Change) => boolean) => changes.filter(test).length;
  const parts: [number, string][] = [
    [count(c => c.field === 'price'), 'price'], [count(c => c.field === 'name'), 'name'],
    [count(c => c.field === 'styles'), 'food style'], [count(c => c.field === 'sub'), 'move'],
  ];
  const hidden = count(c => c.field === 'shown' && c.to === 'Hidden');
  const shown = count(c => c.field === 'shown' && c.to === 'Shown');
  return [...parts.filter(([n]) => n).map(([n, w]) => plural(n, w)), hidden ? `${hidden} hidden` : '', shown ? `${shown} shown` : ''].filter(Boolean).join(', ');
}

// Bad prices, and empty or repeated names among the rows whose name or place changed.
export function cellErrors(bases: SheetRow[], edits: Edits, others: { id: string; name: string; subcategory_id: string }[]): CellErrors {
  const rows = bases.map(b => merged(b, edits));
  const ids = new Set(bases.map(b => b.id));
  const all = [...rows.map(r => ({ id: r.id, name: r.name, sub: r.sub })), ...others.filter(o => !ids.has(o.id)).map(o => ({ id: o.id, name: o.name, sub: o.subcategory_id }))];
  const out: CellErrors = {};
  rows.forEach((r, i) => {
    const changed = changedFields(bases[i], edits[r.id]);
    const err: CellErrors[string] = {};
    if (changed.includes('price')) { const p = readPrice(r.price); if (!p.ok) err.price = p.error; }
    if (changed.includes('name') || changed.includes('sub')) {
      if (!r.name.trim()) err.name = 'Type a name';
      else if (all.some(o => o.id !== r.id && o.sub === r.sub && key(o.name) === key(r.name))) err.name = 'Another dish here has this name';
    }
    if (err.name || err.price) out[r.id] = err;
  });
  return out;
}

// Excel copies rows as lines and cells as tabs, with a trailing line break.
export function parseClip(text: string): string[][] {
  const lines = text.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n');
  return lines.map(l => l.split('\t').map(c => (/^"[\s\S]*"$/.test(c) ? c.slice(1, -1).replace(/""/g, '"') : c)));
}

function fromText(col: Col, text: string): SheetRow[Col] | undefined {
  switch (col) {
    case 'name': return text.trim();
    case 'price': return cleanPrice(text);
    case 'styles': return parseStyles(text);
    default: return parseShown(text) ?? undefined;
  }
}

// Pastes a block from cell (r, c) down and right; lines past the last row are counted, not added.
export function pasteGrid(edits: Edits, bases: SheetRow[], at: { r: number; c: number }, grid: string[][], cols: readonly Col[] = COLS) {
  let next = edits;
  let cells = 0;
  grid.forEach((line, i) => {
    const base = bases[at.r + i];
    if (!base) return;
    line.forEach((text, j) => {
      const col = cols[at.c + j];
      if (!col) return;
      const v = fromText(col, text);
      if (v === undefined) return;
      next = setCell(next, base, col, v);
      cells++;
    });
  });
  return { edits: next, cells, extra: Math.max(0, at.r + grid.length - bases.length) };
}

// Database patches per dish, and the old values that undo puts back.
export function planSave(dishes: Dish[], edits: Edits): { items: SaveItem[]; undo: UndoStep[] } {
  const items: SaveItem[] = [];
  const undo: UndoStep[] = [];
  dishes.forEach(d => {
    const base = rowOf(d);
    const r = merged(base, edits);
    const f = new Set(changedFields(base, edits[d.id]));
    if (!f.size) return;
    const patch: Record<string, unknown> = {};
    const old: Record<string, unknown> = {};
    if (f.has('name')) { patch.name = r.name.trim(); old.name = d.name; }
    if (f.has('price') && readPrice(r.price).ok) { patch.default_price = readPrice(r.price).value; old.default_price = d.default_price ?? null; }
    if (f.has('styles')) { patch.food_styles = r.styles; old.food_styles = d.food_styles ?? []; }
    if (f.has('shown')) { patch.is_active = r.shown; old.is_active = d.is_active; }
    if (f.has('sub')) { patch.subcategory_id = r.sub; old.subcategory_id = d.subcategory_id; }
    if (!Object.keys(patch).length) return;
    items.push({ id: d.id, patch });
    undo.push({ table: 'menu_items', id: d.id, values: old });
  });
  return { items, undo };
}

// One request per identical patch (a bulk price, move or hide), at most `size` ids each.
export function saveGroups(items: SaveItem[], size = 100): { patch: Record<string, unknown>; ids: string[] }[] {
  const byPatch = new Map<string, { patch: Record<string, unknown>; ids: string[] }>();
  items.forEach(i => {
    const k = JSON.stringify(Object.entries(i.patch).sort());
    const g = byPatch.get(k) ?? { patch: i.patch, ids: [] };
    g.ids.push(i.id);
    byPatch.set(k, g);
  });
  return Array.from(byPatch.values()).flatMap(g =>
    Array.from({ length: Math.ceil(g.ids.length / size) }, (_, n) => ({ patch: g.patch, ids: g.ids.slice(n * size, (n + 1) * size) })));
}
