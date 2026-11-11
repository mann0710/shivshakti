import { roundMoney } from '../units';
import { isMoney } from '../payments';
import { CreditItem, ageOf, lateBy } from './items';
import { addDays } from './dates';
import { CreditAccount, CreditEntry, CreditSettings } from './types';

// One customer's credit: what is due, any advance, the account settings and the follow-up state.

export interface Promise { date: string; amount: number; note: string | null; broken: boolean }
export type Follow = 'today' | 'later' | 'none';

export interface Account {
  phone: string;
  name: string;
  items: CreditItem[];      // every credit item, oldest first
  open: CreditItem[];       // still due, oldest first
  owed: number;
  advance: number;          // paid more than owed, kept for next time
  oldest: number;           // days since the oldest unpaid item
  late: number;             // most days past a pay-by date
  limit: number | null;     // null: no limit
  over: number;             // owed above the limit
  settings?: CreditAccount;
  entries: CreditEntry[];   // newest first, voided included
  promise?: Promise;
  lastContact?: CreditEntry;
  nextFollow: string | null;
  follow: Follow;
  since: string;
}

const sum = (list: number[]) => roundMoney(list.reduce((s, n) => s + n, 0));
const live = (e: CreditEntry) => !e.voided_at;
const contact = (e: CreditEntry) => e.kind === 'reminder' || e.kind === 'call';

// Money kept as advance: receipts beyond what they paid off, less advance already used on bills.
export function advanceOf(entries: CreditEntry[], items: CreditItem[]): number {
  const kept = sum(entries.filter(e => e.kind === 'receipt' && live(e)).map(e => e.amount - sum(e.links.map(l => l.amount))));
  const used = sum(items.flatMap(i => i.payments.filter(p => p.kind === 'from_advance').map(p => p.amount)));
  return Math.max(0, roundMoney(kept - used));
}

// Latest promise; broken once its date has passed with money still due and nothing paid since.
function promiseOf(entries: CreditEntry[], owed: number, today: string): Promise | undefined {
  const p = entries.find(e => e.kind === 'promise' && live(e) && e.promise_date);
  if (!p || owed <= 0) return undefined;
  const paidSince = entries.some(e => e.kind === 'receipt' && live(e) && e.at > p.at);
  if (paidSince) return undefined;
  return { date: p.promise_date!, amount: p.amount, note: p.note, broken: p.promise_date! < today };
}

export function accountOf(phone: string, items: CreditItem[], entries: CreditEntry[], settings: CreditSettings, today: string, acc?: CreditAccount): Account {
  const open = items.filter(i => i.due > 0);
  const owed = sum(open.map(i => i.due));
  const promise = promiseOf(entries, owed, today);
  const lastContact = entries.find(e => contact(e) && live(e));
  const disputed = !!acc?.disputed;
  const firstPayBy = open.map(i => i.payBy).sort()[0] ?? null;
  const nextFollow = !owed || disputed ? null
    : promise ? (promise.broken ? today : promise.date)
    : lastContact ? addDays(lastContact.at.slice(0, 10), settings.remind_every)
    : firstPayBy;
  const own = acc?.credit_limit;
  const limit = own != null ? (own > 0 ? own : null) : settings.limit > 0 ? settings.limit : null;
  const name = acc?.name || items[items.length - 1]?.name || entries[0]?.name || phone;
  return {
    phone, name, items, open, owed, advance: advanceOf(entries, items),
    oldest: open.length ? ageOf(open[0], today) : 0,
    late: Math.max(0, ...open.map(i => lateBy(i, today))),
    limit, over: limit != null ? Math.max(0, roundMoney(owed - limit)) : 0,
    settings: acc, entries, promise, lastContact, nextFollow,
    follow: !nextFollow ? 'none' : nextFollow <= today ? 'today' : 'later',
    since: items[0]?.day ?? entries[entries.length - 1]?.at.slice(0, 10) ?? today,
  };
}

// One account per mobile number that ever had credit, an advance or a follow-up.
export function accountsOf(items: CreditItem[], entries: CreditEntry[], accounts: CreditAccount[], settings: CreditSettings, today: string): Account[] {
  const phones = new Set([...items.map(i => i.phone), ...entries.map(e => e.phone)]);
  const byAcc = new Map(accounts.map(a => [a.phone, a]));
  const newest = [...entries].sort((a, b) => b.at.localeCompare(a.at) || b.created_at.localeCompare(a.created_at));
  return Array.from(phones, p => accountOf(p, items.filter(i => i.phone === p), newest.filter(e => e.phone === p), settings, today, byAcc.get(p)));
}

// Money-in rows for credit money that is on no bill: old balances paid back and advances kept.
export function accountMoney(entries: CreditEntry[]) {
  const openings = entries.filter(e => e.kind === 'opening' && live(e)).map(e => ({ payments: (e.payments ?? []).filter(isMoney), madeAt: e.at }));
  const kept = entries.filter(e => e.kind === 'receipt' && live(e) && e.mode).map(e => {
    const extra = roundMoney(e.amount - sum(e.links.map(l => l.amount)));
    return { payments: extra > 0 ? [{ amount: extra, mode: e.mode!, at: e.at, kind: 'due' as const, ref: e.id }] : [], madeAt: e.at };
  });
  return [...openings, ...kept].filter(x => x.payments.length);
}
