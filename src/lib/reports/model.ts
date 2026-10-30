import { inr } from '../money';
import { todayIST } from '../ist';
import { roundMoney } from '../units';

// One report = headline numbers + tables; the screen, print and CSV all render this shape.
export type Fmt = 'text' | 'money' | 'int' | 'pct';
export type Cell = string | number | null | undefined;
export type Row = Record<string, Cell>;
export interface Col { key: string; label: string; fmt?: Fmt }
export interface Table { title: string; cols: Col[]; rows: Row[]; total?: Row; empty: string }
export interface Stat { label: string; value: Cell; fmt?: Fmt; sub?: string; tone?: 'good' | 'bad' | 'warn' }
export interface Report { title: string; note: string; stats: Stat[]; tables: Table[] }

export const isNum = (f?: Fmt) => f === 'money' || f === 'int' || f === 'pct';

export function fmtCell(v: Cell, fmt: Fmt = 'text', money: (n: number) => string = inr): string {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'string') return v;
  if (fmt === 'money') return money(v);
  if (fmt === 'pct') return `${Math.round(v * 10) / 10}%`;
  return v.toLocaleString('en-IN');
}

export const share = (part: number, whole: number) => (whole ? Math.round((part / whole) * 1000) / 10 : 0);
export const sumBy = <T,>(list: T[], f: (x: T) => number) => roundMoney(list.reduce((s, x) => s + (Number(f(x)) || 0), 0));

// Groups rows by a key, keeping first-seen order.
export function groupBy<T>(list: T[], key: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  list.forEach(x => { const k = key(x); m.set(k, [...(m.get(k) ?? []), x]); });
  return m;
}

// Date ranges are IST calendar days as YYYY-MM-DD, both ends included.
export interface Range { from: string; to: string }
export type Preset = 'today' | 'yesterday' | 'week' | 'month' | 'lastMonth' | 'fy' | 'year' | 'custom';
export const PRESETS: [Preset, string][] = [
  ['today', 'Today'], ['yesterday', 'Yesterday'], ['week', 'Last 7 days'], ['month', 'This month'],
  ['lastMonth', 'Last month'], ['fy', 'This FY'], ['year', 'This year'], ['custom', 'Custom'],
];

export const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export function presetRange(p: Preset, today = todayIST()): Range {
  const [y, m] = today.split('-').map(Number);
  const first = `${today.slice(0, 7)}-01`;
  switch (p) {
    case 'yesterday': { const d = addDays(today, -1); return { from: d, to: d }; }
    case 'week': return { from: addDays(today, -6), to: today };
    case 'month': return { from: first, to: today };
    case 'lastMonth': { const end = addDays(first, -1); return { from: `${end.slice(0, 7)}-01`, to: end }; }
    case 'fy': return { from: `${m >= 4 ? y : y - 1}-04-01`, to: today };
    case 'year': return { from: `${y}-01-01`, to: today };
    default: return { from: today, to: today };
  }
}

export const inRange = (day: string | null | undefined, r: Range) => !!day && day >= r.from && day <= r.to;
export const spanDays = (r: Range) => Math.round((Date.parse(r.to) - Date.parse(r.from)) / 86400000) + 1;

const dayFmt = (d: string, opts: Intl.DateTimeFormatOptions) => new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', opts);
export const showDay = (d: string) => dayFmt(d, { day: '2-digit', month: 'short', year: 'numeric' });
export const showMonth = (ym: string) => dayFmt(`${ym}-01`, { month: 'short', year: 'numeric' });
export const rangeLabel = (r: Range) => (r.from === r.to ? showDay(r.from) : `${showDay(r.from)} – ${showDay(r.to)}`);

// Day rows for short ranges, month rows for long ones.
export const bucketOf = (r: Range) => (spanDays(r) > 62 ? { key: (d: string) => d.slice(0, 7), show: showMonth, label: 'Month' } : { key: (d: string) => d, show: showDay, label: 'Date' });
