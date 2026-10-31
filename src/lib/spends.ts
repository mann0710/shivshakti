import { Range, inRange } from './reports/model';
import { sumOf } from './moneyView';

// Money going out: what it was for, which event or counter it belongs to, and pasted rows from Excel.

export const SPEND_KINDS = ['Groceries', 'Cooks & staff', 'Gas', 'Transport', 'Packaging', 'Rent & bills', 'Other'] as const;
export type SpendKind = typeof SPEND_KINDS[number];
export type SpendScope = 'event' | 'sweets' | 'shop';
export const SCOPES: [SpendScope, string][] = [['event', 'An event'], ['sweets', 'Sweets counter'], ['shop', 'Shop']];
export type SpendMode = 'cash' | 'upi' | 'bank';
export const SPEND_MODES: [SpendMode, string][] = [['cash', 'Cash'], ['upi', 'UPI'], ['bank', 'Bank']];

export interface Spend {
  id: string;
  spent_on: string;
  amount: number;
  kind: string;
  scope: SpendScope;
  booking_id?: string | null;
  mode: SpendMode;
  note?: string | null;
  created_at: string;
}
export type SpendDraft = Omit<Spend, 'id' | 'created_at'>;

const WORDS: [RegExp, SpendKind][] = [
  [/cook|staff|labou?r|waiter|helper|salary|wage/i, 'Cooks & staff'],
  [/grocer|ration|vegetable|sabji|milk|oil|ghee|flour|atta|sugar|dry ?fruit/i, 'Groceries'],
  [/gas|cylinder|fuel|coal/i, 'Gas'],
  [/transport|tempo|truck|rickshaw|petrol|diesel|delivery/i, 'Transport'],
  [/pack|box|carry ?bag|foil/i, 'Packaging'],
  [/rent|bill|electric|light|water|phone|internet/i, 'Rent & bills'],
];
export const guessKind = (text: string): SpendKind => WORDS.find(([re]) => re.test(text))?.[1] ?? 'Other';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const pad = (n: number) => String(n).padStart(2, '0');

// "13 Sep", "13/09", "13-09-2026" or "2026-09-13"; the year defaults to the latest one not after today.
export function parseDay(text: string, today: string): string | null {
  const t = text.trim().toLowerCase();
  let d = 0, m = 0, y = 0;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  const named = /^(\d{1,2})[\s-]*([a-z]{3})[a-z]*[\s,-]*(\d{4})?$/.exec(t);
  const nums = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/.exec(t);
  if (iso) { y = Number(iso[1]); m = Number(iso[2]); d = Number(iso[3]); }
  else if (named) { d = Number(named[1]); m = MONTHS.indexOf(named[2]) + 1; y = Number(named[3] || 0); }
  else if (nums) { d = Number(nums[1]); m = Number(nums[2]); y = Number(nums[3] || 0); }
  else return null;
  if (y && y < 100) y += 2000;
  if (!y) { y = Number(today.slice(0, 4)); if (`${y}-${pad(m)}-${pad(d)}` > today) y -= 1; }
  const real = new Date(Date.UTC(y, m - 1, d));
  return m >= 1 && m <= 12 && real.getUTCDate() === d && real.getUTCMonth() === m - 1 ? `${y}-${pad(m)}-${pad(d)}` : null;
}

export interface PastedRow { line: string; day: string | null; amount: number; kind: SpendKind; what: string; ok: boolean }

const ROW = /^(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?|\d{1,2}[\s-]*[a-z]{3,9}(?:[\s,-]+\d{4})?)[\s,;]*₹?\s*([\d,]+(?:\.\d+)?)[\s,;]*(.*)$/i;

// One spend per line: date, amount, what for (tabs, commas or spaces between).
export function parsePasted(text: string, today: string): PastedRow[] {
  return text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(line => {
    const m = ROW.exec(line);
    const day = m ? parseDay(m[1], today) : null;
    const amount = m ? Number(m[2].replace(/,/g, '')) || 0 : 0;
    const what = m ? m[3].trim() : line;
    return { line, day, amount, kind: guessKind(what), what, ok: !!day && amount > 0 };
  });
}

export const spendsIn = (list: Spend[], r: Range) => list.filter(s => inRange(s.spent_on, r));
export const spentTotal = (list: Spend[]) => sumOf(list, s => s.amount);
export function byKind(list: Spend[]) {
  return SPEND_KINDS.map(kind => ({ kind, amount: sumOf(list.filter(s => (s.kind === kind) || (kind === 'Other' && !SPEND_KINDS.includes(s.kind as SpendKind))), s => s.amount) }))
    .filter(k => k.amount > 0);
}
