import { roundMoney } from '../units';
import { isMoney } from '../payments';
import { istDay } from '../preorders';
import { phoneKey } from '../people';
import { Account } from './accounts';
import { AGES, ageBucket, ageOf, CreditItem } from './items';
import { CreditEntry } from './types';

// Filters, sorting and totals for the Credit tab.

export type Filter = 'today' | 'late' | 'promised' | 'disputed' | 'owing' | 'advance' | 'settled';
export type Sort = 'follow' | 'owed' | 'oldest' | 'name';

export const FILTERS: { id: Filter; label: string }[] = [
  { id: 'today', label: 'Follow up today' }, { id: 'late', label: 'Overdue' }, { id: 'promised', label: 'Promised' },
  { id: 'disputed', label: 'Disputed' }, { id: 'owing', label: 'All owing' }, { id: 'advance', label: 'Advance' }, { id: 'settled', label: 'Settled' },
];

export const isDisputed = (a: Account) => !!a.settings?.disputed;

export function matches(a: Account, f: Filter): boolean {
  switch (f) {
    case 'today': return a.follow === 'today' && !isDisputed(a);
    case 'late': return a.owed > 0 && (a.late > 0 || !!a.promise?.broken);
    case 'promised': return !!a.promise && !a.promise.broken;
    case 'disputed': return a.owed > 0 && isDisputed(a);
    case 'owing': return a.owed > 0;
    case 'advance': return a.advance > 0;
    case 'settled': return a.owed <= 0 && a.advance <= 0;
  }
}

export const counts = (list: Account[]) => Object.fromEntries(FILTERS.map(f => [f.id, list.filter(a => matches(a, f.id)).length])) as Record<Filter, number>;

// Name, mobile (3+ digits) or bill number.
export function search(list: Account[], q: string): Account[] {
  const t = q.trim().toLowerCase();
  if (!t) return list;
  const digits = t.replace(/\D/g, '');
  return list.filter(a => a.name.toLowerCase().includes(t) || (digits.length >= 3 && a.phone.includes(digits))
    || a.items.some(i => i.label.toLowerCase().includes(t.startsWith('#') ? t : `#${t}`)));
}

const rank = (a: Account) => (a.follow === 'today' ? 0 : a.promise?.broken ? 1 : a.late > 0 ? 2 : 3);
export function sortAccounts(list: Account[], s: Sort): Account[] {
  const out = [...list];
  if (s === 'owed') return out.sort((a, b) => b.owed - a.owed);
  if (s === 'oldest') return out.sort((a, b) => b.oldest - a.oldest);
  if (s === 'name') return out.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
  return out.sort((a, b) => rank(a) - rank(b) || b.owed - a.owed);
}

const sum = (list: number[]) => roundMoney(list.reduce((s, n) => s + n, 0));

// What is still due, split by how old each bill is (not by person).
export const ageSplit = (accounts: Account[], today: string) => {
  const out = AGES.map(() => 0);
  accounts.flatMap(a => a.open).forEach(i => { out[ageBucket(ageOf(i, today))] += i.due; });
  return out.map(roundMoney);
};

// Money received against credit items and old balances in the month of `today`.
function gotIn(items: CreditItem[], entries: CreditEntry[], month: string) {
  const onItems = items.flatMap(i => i.payments.filter(p => isMoney(p) && p.kind === 'due' && istDay(p.at).startsWith(month)));
  const kept = entries.filter(e => e.kind === 'receipt' && !e.voided_at && istDay(e.at).startsWith(month))
    .map(e => ({ mode: e.mode, amount: roundMoney(e.amount - sum(e.links.map(l => l.amount))) }));
  const all = [...onItems.map(p => ({ mode: p.mode, amount: p.amount })), ...kept];
  return { total: sum(all.map(x => x.amount)), cash: sum(all.filter(x => x.mode === 'cash').map(x => x.amount)), upi: sum(all.filter(x => x.mode === 'upi').map(x => x.amount)) };
}

export function tabTotals(accounts: Account[], today: string) {
  const owing = accounts.filter(a => a.owed > 0);
  const follow = accounts.filter(a => matches(a, 'today'));
  const month = today.slice(0, 7);
  const items = accounts.flatMap(a => a.items);
  const given = items.filter(i => i.day.startsWith(month) && !i.cancelled);
  return {
    owed: sum(owing.map(a => a.owed)), people: owing.length, oldest: Math.max(0, ...owing.map(a => a.oldest)),
    follow: follow.length, followOwed: sum(follow.map(a => a.owed)), broken: follow.filter(a => a.promise?.broken).length,
    given: sum(given.map(i => i.given)), givenCount: given.length,
    got: gotIn(items, accounts.flatMap(a => a.entries), month),
    advance: sum(accounts.map(a => a.advance)),
  };
}

export const accountFor = (list: Account[], phone: string) => { const k = phoneKey(phone); return k ? list.find(a => a.phone === k) : undefined; };
