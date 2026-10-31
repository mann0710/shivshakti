import type { XCell, XSheet } from './xlsx';
import { inr } from './money';

// Shared planning for Excel imports and pasted lists: columns, amounts, look-alike names and the preview plan.

export type TileId = 'new' | 'changed' | 'moved' | 'other' | 'same' | 'decide';
export type Tone = 'new' | 'added' | 'changed' | 'moved' | 'other' | 'same' | 'decide';
export interface Detail { label: string; old: string; next: string }
export interface Change { row: number; tile: TileId; tone: Tone; chip: string; name: string; where: string; details: Detail[] }
export interface Decision { id: string; row: number; text: string; yes: string; no: string }
export type Answers = Record<string, boolean>;
export interface Skip { row: number; name: string; why: string }
// A row to add (no `old`), or the changed columns of a saved row with their old values.
export interface Write { table: string; id: string; values: Record<string, unknown>; old?: Record<string, unknown> }
export interface Plan {
  sheet: string; rows: number; missing: string[]; changes: Change[]; decisions: Decision[]; open: number; skipped: Skip[]; writes: Write[];
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-IN')} ${n === 1 ? one : many}`;
export const rupees = (n?: number | null) => (Number(n) > 0 ? inr(Number(n)) : 'no price');

// ─── Cells and columns ────────────────────────────────────────────────────────
export const cellText = (v: XCell): string =>
  v === null || v === undefined ? '' : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v).replace(/\s+/g, ' ').trim();

// Same name ignoring case, spaces and punctuation: "Dahi-Puri" = "dahi puri".
export const matchKey = (s: string) => {
  const k = s.toLowerCase().replace(/[\s!-/:-@[-`{-~₹·•–—]/g, '');
  return k || s.trim().toLowerCase();
};

export interface Column { key: string; label: string; names: string[]; required?: boolean }
export interface BodyRow { row: number; cells: XCell[] }
export interface Body { sheet: string; cols: Record<string, number>; heads: Record<string, string>; rows: BodyRow[]; missing: string[] }

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
const spaced = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;

// Column index per key: an exact name first, then a header starting with one, then one containing it as words.
export function matchHeaders(header: XCell[], columns: Column[]): Record<string, number> {
  const heads = header.map(h => cellText(h));
  const used = new Set<number>();
  const out: Record<string, number> = {};
  const pass = (test: (h: string, n: string) => boolean) => columns.forEach(c => {
    if (c.key in out) return;
    const i = heads.findIndex((h, at) => !!h && !used.has(at) && c.names.some(n => test(h, n)));
    if (i >= 0) { out[c.key] = i; used.add(i); }
  });
  pass((h, n) => squash(h) === squash(n));
  pass((h, n) => squash(h).startsWith(squash(n)));
  pass((h, n) => spaced(h).includes(spaced(n)));
  return out;
}

// The sheet and header row (within the first ten) that best fit the columns; data rows keep their Excel row number.
export function readBody(sheets: XSheet[], columns: Column[]): Body {
  const need = columns.filter(c => c.required);
  let best = { s: 0, y: 0, cols: {} as Record<string, number>, score: -1 };
  sheets.forEach((sheet, s) => sheet.rows.slice(0, 10).forEach((r, y) => {
    const cols = matchHeaders(r ?? [], columns);
    const found = Object.keys(cols).length;
    const score = (need.every(c => c.key in cols) ? 100 : 0) + found;
    if (found && score > best.score) best = { s, y, cols, score };
  }));
  const sheet = sheets[best.s];
  const header = sheet?.rows[best.y] ?? [];
  const rows = (sheet?.rows ?? []).slice(best.y + 1)
    .map((cells, i) => ({ row: best.y + i + 2, cells: cells ?? [] }))
    .filter(r => r.cells.some(c => cellText(c)));
  const heads = Object.fromEntries(Object.entries(best.cols).map(([k, i]) => [k, cellText(header[i])]));
  return { sheet: sheet?.name ?? '', cols: best.cols, heads, rows, missing: need.filter(c => !(c.key in best.cols)).map(c => c.label) };
}

// Cell of a column, or undefined when the file has no such column.
export const cellOf = (body: Body, r: BodyRow, key: string): XCell | undefined => (key in body.cols ? r.cells[body.cols[key]] ?? null : undefined);
export const textOf = (body: Body, r: BodyRow, key: string) => cellText(cellOf(body, r, key));

// Yes / No typed in many ways; null when it is empty or means neither.
export function parseYesNo(v: XCell | undefined): boolean | null {
  if (typeof v === 'boolean') return v;
  const t = cellText(v).toLowerCase();
  if (/^(yes|y|true|1|on|shown?|show|visible|active)$/.test(t)) return true;
  if (/^(no|n|false|0|off|hidden|hide|inactive)$/.test(t)) return false;
  return null;
}

// ─── Amounts ─────────────────────────────────────────────────────────────────
export type Amount = { kind: 'empty' } | { kind: 'ok'; value: number } | { kind: 'messy'; value: number; shape: string } | { kind: 'bad' };
const NUM = /\d[\d,]*(?:\.\d+)?/g;
const toNumber = (s: string) => Math.round(Number(s.replace(/,/g, '')) * 100) / 100;

// "60" is fine; "₹ 60/-" holds one number but needs a yes; "40-50" or "on request" is not a price.
export function parseAmount(v: XCell | undefined): Amount {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? { kind: 'ok', value: Math.round(v * 100) / 100 } : { kind: 'bad' };
  const t = cellText(v);
  if (!t || /^[-–—]+$/.test(t)) return { kind: 'empty' };
  // A minus sign in front is a negative number, never a price.
  if (/^[-–—]\s*\d/.test(t)) return { kind: 'bad' };
  if (/^(\d{1,3}(,\d{2,3})+|\d+)(\.\d+)?$/.test(t)) return { kind: 'ok', value: toNumber(t) };
  const nums = t.match(NUM) ?? [];
  if (nums.length !== 1) return { kind: 'bad' };
  return { kind: 'messy', value: toNumber(nums[0]), shape: t.toLowerCase().replace(NUM, '#') };
}

// How many cells share each messy shape, so one yes can fix them all.
export function shapeCounts(cells: (XCell | undefined)[]): Map<string, number> {
  const out = new Map<string, number>();
  cells.forEach(c => { const a = parseAmount(c); if (a.kind === 'messy') out.set(a.shape, (out.get(a.shape) ?? 0) + 1); });
  return out;
}

// ─── Look-alike names ────────────────────────────────────────────────────────
const compact = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
// Indian spellings vary: "Cassata" / "Kasata", "Paneer" / "Panir", "Chaat" / "Chat".
export const soundKey = (s: string) => compact(s)
  .replace(/ph/g, 'f').replace(/[cq]/g, 'k').replace(/w/g, 'v').replace(/z/g, 'j')
  .replace(/([kgjtdpbs])h/g, '$1').replace(/ee/g, 'i').replace(/oo/g, 'u').replace(/(.)\1+/g, '$1');

function distance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

// 1 for the same text, falling towards 0; skips the work when the lengths alone rule it out.
const ratio = (a: string, b: string, min = 0) => {
  const m = Math.max(a.length, b.length);
  if (!m) return 0;
  if (Math.abs(a.length - b.length) > (1 - min) * m) return 0;
  return 1 - distance(a, b) / m;
};

const wordsOf = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).map(soundKey);
// Every word of the shorter name is in the longer one: "Delhi Chaat" in "Delhi Ki Chaat".
const within = (a: string, b: string) => {
  const [x, y] = [wordsOf(a), wordsOf(b)];
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length > 0 && short.every(w => long.includes(w));
};

export const similarity = (a: string, b: string, words = false) => {
  const r = Math.max(ratio(compact(a), compact(b)), ratio(soundKey(a), soundKey(b)));
  return words && within(a, b) ? Math.max(r, 0.9) : r;
};

// Closest name at or above `min`; `words` also accepts a name whose words all appear in the other.
export function fuzzy<T>(list: T[], nameOf: (t: T) => string, words = false) {
  const items = list.map(t => ({ t, name: nameOf(t), c: compact(nameOf(t)), s: soundKey(nameOf(t)) }));
  return (name: string, min: number, keep: (t: T) => boolean = () => true): T | undefined => {
    const c = compact(name);
    const s = soundKey(name);
    let best: T | undefined;
    let top = min;
    for (const it of items) {
      if (!keep(it.t)) continue;
      let r = Math.max(ratio(c, it.c, top), ratio(s, it.s, top));
      if (words && within(name, it.name)) r = Math.max(r, 0.9);
      if (r > top || (r === top && !best)) { best = it.t; top = r; }
    }
    return best;
  };
}

// Saved rows by key; each saved row goes to one file row only.
export function claims<T extends { id: string }>(list: T[], keyOf: (t: T) => string) {
  const by = new Map<string, T[]>();
  list.forEach(t => { const k = keyOf(t); if (k) by.set(k, [...(by.get(k) ?? []), t]); });
  const taken = new Set<string>();
  return {
    find: (key: string, where: (t: T) => boolean = () => true) => (key ? (by.get(key) ?? []).find(t => !taken.has(t.id) && where(t)) : undefined),
    take: (t: T) => { taken.add(t.id); return t; },
    free: (t: T) => !taken.has(t.id),
  };
}

// ─── Building a plan ─────────────────────────────────────────────────────────
export class PlanBuilder {
  private decisions: Decision[] = [];
  private changes: Change[] = [];
  private skipped: Skip[] = [];
  private inserts: Write[] = [];
  private updates: Write[] = [];

  constructor(private answers: Answers) {}

  // Lists a decision once and returns its answer so far (undefined while open).
  ask(d: Decision): boolean | undefined {
    if (!this.decisions.some(x => x.id === d.id)) this.decisions.push(d);
    return this.answers[d.id];
  }

  change(c: Change) { this.changes.push(c); }
  wait(row: number, name: string, where: string) { this.change({ row, tile: 'decide', tone: 'decide', chip: 'Needs a decision', name, where, details: [] }); }
  skip(row: number, name: string, why: string) { this.skipped.push({ row, name, why }); }
  insert(table: string, id: string, values: Record<string, unknown>) { this.inserts.push({ table, id, values: { id, ...values } }); }
  update(table: string, id: string, values: Record<string, unknown>, old: Record<string, unknown>) {
    if (Object.keys(values).length) this.updates.push({ table, id, values, old });
  }

  // Adds go parent tables first (`order`), then the changes to saved rows.
  finish(body: Body, order: string[]): Plan {
    const decisions = [...this.decisions].sort((a, b) => a.row - b.row);
    return {
      sheet: body.sheet, rows: body.rows.length, missing: body.missing, decisions,
      open: decisions.filter(d => this.answers[d.id] === undefined).length,
      changes: [...this.changes].sort((a, b) => a.row - b.row),
      skipped: [...this.skipped].sort((a, b) => a.row - b.row),
      writes: [...order.flatMap(t => this.inserts.filter(w => w.table === t)), ...this.updates],
    };
  }
}

// A price cell: the number to use, null to leave it, or 'skip' / 'wait' from its decision.
export function priceDecision(b: PlanBuilder, cell: XCell | undefined, row: number, shapes: Map<string, number>): number | null | 'skip' | 'wait' {
  const a = parseAmount(cell);
  if (a.kind === 'empty') return null;
  if (a.kind === 'ok') return a.value > 0 ? a.value : null;
  const raw = cellText(cell);
  if (a.kind === 'messy') {
    const n = shapes.get(a.shape) ?? 1;
    const more = n > 1 ? ` Same fix for ${plural(n - 1, 'more row')} written like this.` : '';
    const ok = b.ask({
      id: `price:${a.shape}`, row, text: `Price "${raw}" is not a number. Use ${a.value}?${more}`,
      yes: n > 1 ? `Use ${a.value} · fix all ${n}` : `Use ${a.value}`, no: n > 1 ? `Skip these ${n} rows` : 'Skip row',
    });
    return ok === undefined ? 'wait' : ok ? a.value : 'skip';
  }
  const ok = b.ask({ id: `bad:${row}`, row, text: `Price "${raw}" is not a number.`, yes: 'Leave the price out', no: 'Skip row' });
  return ok === undefined ? 'wait' : ok ? null : 'skip';
}

export const skipLabel = (n: number) => (n > 1 ? `Skip these ${n} rows` : 'Skip row');

// A row repeating an earlier row's key is left out (returns the first row), unless that many copies are saved.
export function firstRows(saved: (key: string) => number = () => 0) {
  const seen = new Map<string, number[]>();
  return (key: string, row: number): number | undefined => {
    const before = seen.get(key) ?? [];
    seen.set(key, [...before, row]);
    return before.length >= Math.max(1, saved(key)) ? before[0] : undefined;
  };
}

export const countBy = <T,>(list: T[], keyOf: (t: T) => string) => {
  const out = new Map<string, number>();
  list.forEach(t => { const k = keyOf(t); out.set(k, (out.get(k) ?? 0) + 1); });
  return out;
};

// ─── Pasted lists ────────────────────────────────────────────────────────────
export interface PastedLine { line: number; name: string; price: number | null; whole: string }

const BULLET = /^(?:[-*•·▪►✓✔]+|\d{1,3}[.)])\s+/;
const EDGE = /^[\s–—:=@|,.-]+|[\s–—:=@|,.-]+$/g;
const TAIL = /^(.*?)([\s–—:=@|,-]*)(₹|rs\.?|inr)?\s*(\d[\d,]*(?:\.\d{1,2})?)\s*(?:\/-|\/|-)?\s*(?:(?:per|\/)\s*(?:plate|pcs?|piece|kg))?\s*(?:rs\.?|₹|only)?\.?\s*$/i;

const tidy = (s: string) => s.replace(/[*_~]/g, '').replace(/\s+/g, ' ').trim().replace(BULLET, '').replace(EDGE, '');

// A cell that is only a price ("60", "₹ 60/-"), as a number.
const priceOnly = (cell: string): number | null => {
  const m = TAIL.exec(cell);
  return m && !tidy(m[1]) ? toNumber(m[4]) : null;
};

// "Raj Kachori 60", "Dahi Puri - 50", "Pani Puri (5 flavour) 40", "Kulfi ₹ 60/-"; "Paneer65" keeps its digits.
function splitTail(text: string): Omit<PastedLine, 'line'> {
  const whole = tidy(text);
  const m = TAIL.exec(text.replace(/[*_~]/g, ''));
  const name = m ? tidy(m[1]) : '';
  if (!m || !name || (!m[2] && !m[3])) return { name: whole, price: null, whole };
  return { name, price: toNumber(m[4]) || null, whole };
}

// One dish per line from WhatsApp or Excel (tab-separated cells); blank lines are dropped.
export function parsePasteList(text: string): PastedLine[] {
  return text.split(/\r?\n/).flatMap((raw, i) => {
    const cells = raw.split('\t').map(c => c.trim()).filter(Boolean);
    const at = cells.findIndex(c => priceOnly(c) === null && tidy(c));
    if (at < 0) return [];
    const later = cells.slice(at + 1).map(priceOnly).filter((n): n is number => n !== null);
    const read = later.length ? { name: tidy(cells[at]), price: later[later.length - 1] || null, whole: tidy(cells[at]) } : splitTail(cells[at]);
    return read.name ? [{ line: i + 1, ...read }] : [];
  });
}
