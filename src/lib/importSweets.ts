import type { SeasonalItem } from './itemCatalog';
import type { XCell, XSheet } from './xlsx';
import { legacySize, toRow } from './itemCatalog';
import { PriceUnit, UNITS, rateLabel } from './units';
import {
  Answers, BodyRow, Column, Detail, Plan, PlanBuilder, cellOf, claims, countBy, firstRows, fuzzy, matchKey,
  parseYesNo, priceDecision, readBody, shapeCounts, skipLabel, textOf,
} from './importPlan';

// Sweets import: name, price per kg / litre / piece, occasion and whether it is on the POS.

export interface Occasion { id: string; name: string }
export interface SweetData { items: SeasonalItem[]; occasions: Occasion[]; legacy: boolean }

export const SWEET_COLUMNS: Column[] = [
  { key: 'name', label: 'Sweet', names: ['sweet', 'sweet name', 'item', 'item name', 'name', 'product', 'mithai'], required: true },
  { key: 'price', label: 'Price', names: ['price', 'price per kg', 'rate', 'rate per kg', 'per kg', 'price per litre', 'price per piece', 'mrp', 'amount'] },
  { key: 'unit', label: 'Unit', names: ['unit', 'sold by', 'sold per', 'uom', 'per'] },
  { key: 'occasion', label: 'Occasion', names: ['occasion', 'festival', 'season'] },
  { key: 'pos', label: 'On POS', names: ['on pos', 'pos', 'show on pos', 'on counter', 'active', 'available'] },
];
const TABLE = 'seasonal_items';
const UNIT_WORD: Record<PriceUnit, string> = { kg: 'kg', ltr: 'litre', pc: 'piece' };
const yesNo = (b: boolean) => (b ? 'Yes' : 'No');

// "kg", "Litre", "pcs", "per piece"; null when it is none of them.
export function parseUnit(text: string): PriceUnit | null {
  const t = text.toLowerCase().replace(/^per\s*|[^a-z]/g, '');
  if (/^(kg|kgs|kilo|kilos|kilogram|kilograms)$/.test(t)) return 'kg';
  if (/^(l|lt|ltr|ltrs|litre|litres|liter|liters)$/.test(t)) return 'ltr';
  if (/^(pc|pcs|piece|pieces|nos|no|each)$/.test(t)) return 'pc';
  return null;
}

// "Price per litre" as a header means litres when there is no Unit cell.
const headerUnit = (head = ''): PriceUnit | null =>
  /litre|liter|ltr/i.test(head) ? 'ltr' : /piece|\bpcs?\b|\bnos\b/i.test(head) ? 'pc' : /\bkg\b|kilo/i.test(head) ? 'kg' : null;

export const sweetTemplate = (): XCell[][] => [SWEET_COLUMNS.map(c => c.label), ['Kaju Katli', 1200, 'kg', 'Diwali', 'Yes']];

export function sweetSheet({ items, occasions }: SweetData): XCell[][] {
  const occ = new Map(occasions.map(o => [o.id, o.name]));
  const rows = [...items].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
    .map(i => [i.name, i.rate || null, UNIT_WORD[i.unit], occ.get(i.occasion_id ?? '') ?? '', yesNo(i.is_active)]);
  return [SWEET_COLUMNS.map(c => c.label), ...rows];
}

interface Next { rate: number | null; unit: PriceUnit | null; occasion: string | null | undefined; pos: boolean | null }

// Changed columns of a saved sweet; a new unit starts again from the shop's pack sizes.
function diffSweet(item: SeasonalItem, next: Next, legacy: boolean) {
  const values: Record<string, unknown> = {};
  const unit = next.unit ?? item.unit;
  const rate = next.rate ?? item.rate;
  if (unit !== item.unit) {
    Object.assign(values, { weight: UNITS[unit].factor, weight_unit: unit === 'ltr' ? 'ltr' : 'gm', price: rate });
    if (!legacy) Object.assign(values, { unit, rate, pack_sizes: null, pack_prices: null });
  } else if (rate !== item.rate) {
    const size = legacySize(item);
    values.price = size ? Math.round((rate * size) / UNITS[unit].factor) : rate;
    if (!legacy) values.rate = rate;
    // Owner-set pack prices move by the same share as the rate.
    if (!legacy && item.pack_prices && item.rate > 0) {
      values.pack_prices = Object.fromEntries(Object.entries(item.pack_prices).map(([k, v]) => [k, Math.round((Number(v) * rate) / item.rate)]));
    }
  }
  if (next.occasion !== undefined && next.occasion !== (item.occasion_id ?? null)) values.occasion_id = next.occasion;
  if (next.pos !== null && next.pos !== item.is_active) values.is_active = next.pos;
  const row = item as unknown as Record<string, unknown>;
  const old = Object.fromEntries(Object.keys(values).map(k => [k, row[k] ?? null]));
  return { values, old };
}

export function planSweets(sheets: XSheet[], data: SweetData, answers: Answers, newId: () => string): Plan {
  const body = readBody(sheets, SWEET_COLUMNS);
  const b = new PlanBuilder(answers);
  if (body.missing.length) return b.finish(body, [TABLE]);
  const text = (r: BodyRow, k: string) => textOf(body, r, k);
  const occName = new Map(data.occasions.map(o => [o.id, o.name]));
  const occByKey = new Map(data.occasions.map(o => [matchKey(o.name), o]));
  const nearOcc = fuzzy(data.occasions, o => o.name, true);
  const occCount = countBy(body.rows, r => matchKey(text(r, 'occasion')));
  const shapes = shapeCounts(body.rows.map(r => cellOf(body, r, 'price')));
  const saved = claims(data.items, i => matchKey(i.name));
  const near = fuzzy(data.items, i => i.name);
  const copies = countBy(data.items, i => matchKey(i.name));
  const first = firstRows(k => copies.get(k) ?? 0);
  const fileUnit = headerUnit(body.heads.price);
  const label = (o: string | null | undefined) => (o ? occName.get(o) ?? '' : 'All year');

  // Occasion id, null for all year, undefined to leave it, or 'skip' / 'wait'.
  const occasionOf = (raw: string, row: number): string | null | undefined | 'skip' | 'wait' => {
    if (!raw) return undefined;
    if (/^(all ?year|always|regular|daily|none|no|-)$/i.test(raw)) return null;
    const hit = occByKey.get(matchKey(raw));
    if (hit) return hit.id;
    const like = nearOcc(raw, 0.7);
    const n = occCount.get(matchKey(raw)) ?? 1;
    const ok = like
      ? b.ask({ id: `occ:${matchKey(raw)}`, row, text: `Occasion "${raw}" is not set up. Did you mean "${like.name}"?`, yes: `Use ${like.name}`, no: 'Leave the occasion out' })
      : b.ask({ id: `occ:${matchKey(raw)}`, row, text: `Occasion "${raw}" is not set up yet. Add it under Sweets › Occasions to use it.`, yes: 'Leave the occasion out', no: skipLabel(n) });
    if (ok === undefined) return 'wait';
    return like ? (ok ? like.id : undefined) : ok ? undefined : 'skip';
  };

  body.rows.forEach(r => {
    const name = text(r, 'name');
    if (!name) { b.skip(r.row, '', 'No sweet name'); return; }
    const twice = first(matchKey(name), r.row);
    if (twice) { b.skip(r.row, name, `Listed twice; row ${twice} is used`); return; }
    let item = saved.find(matchKey(name));
    let waiting = false;
    const like = item ? undefined : near(name, 0.85, saved.free);
    if (like) {
      const ok = b.ask({ id: `same:${r.row}`, row: r.row, text: `"${name}" looks like "${like.name}", which is already saved.`, yes: 'Same sweet — update it', no: 'Add as new sweet' });
      waiting = ok === undefined;
      if (ok) item = like;
    }
    if (item) saved.take(item);
    const price = priceDecision(b, cellOf(body, r, 'price'), r.row, shapes);
    const occasion = occasionOf(text(r, 'occasion'), r.row);
    if (price === 'skip' || occasion === 'skip') { b.skip(r.row, name, 'Skipped'); return; }
    if (waiting || price === 'wait' || occasion === 'wait') { b.wait(r.row, name, ''); return; }
    // A saved sweet keeps its unit unless the Unit cell says otherwise.
    const unit = parseUnit(text(r, 'unit')) ?? (item ? null : fileUnit ?? 'kg');
    const pos = parseYesNo(cellOf(body, r, 'pos'));

    if (!item) {
      if (price === null) { b.skip(r.row, name, 'A new sweet needs a price'); return; }
      const u = unit ?? 'kg';
      const row = toRow({ name, unit: u, rate: price, pack_sizes: null, pack_prices: null, category: null, occasion_id: occasion ?? null, is_active: pos ?? true }, data.legacy);
      b.insert(TABLE, newId(), row);
      b.change({ row: r.row, tile: 'new', tone: 'new', chip: 'New sweet', name, where: label(occasion), details: [{ label: 'Price', old: '—', next: rateLabel(price, u) }] });
      return;
    }
    const d = diffSweet(item, { rate: price, unit, occasion, pos }, data.legacy);
    b.update(TABLE, item.id, d.values, d.old);
    const nextUnit = unit ?? item.unit;
    const details: Detail[] = [];
    const priced = d.values.price !== undefined;
    if (priced) details.push({ label: 'Price', old: item.rate > 0 ? rateLabel(item.rate, item.unit) : 'no price', next: rateLabel(price ?? item.rate, nextUnit) });
    if ('occasion_id' in d.values) details.push({ label: 'Occasion', old: label(item.occasion_id), next: label(occasion) });
    if ('is_active' in d.values) details.push({ label: 'On POS', old: yesNo(item.is_active), next: yesNo(!!pos) });
    const base = { row: r.row, name: item.name, where: label('occasion_id' in d.values ? occasion : item.occasion_id), details };
    if (priced) b.change({ ...base, tile: 'changed', tone: item.rate > 0 ? 'changed' : 'added', chip: item.rate > 0 ? 'Price changed' : 'Price added' });
    else if (details.length) b.change({ ...base, tile: 'other', tone: 'other', chip: 'Updated' });
    else b.change({ ...base, tile: 'same', tone: 'same', chip: 'Same', details: [{ label: 'Price', old: '', next: rateLabel(item.rate, item.unit) }] });
  });
  return b.finish(body, [TABLE]);
}
