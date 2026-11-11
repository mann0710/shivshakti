import { roundMoney } from '../units';
import { MODE_LABEL, Payment } from '../payments';
import { istDay } from '../preorders';
import { Account } from './accounts';
import { CreditItem } from './items';

// The account statement: given on credit, got back, running balance (negative: advance with us).

export interface LedgerRow { at: string; day: string; what: string; sub: string; given: number; got: number; balance: number; ref?: string }

// Paid off later: money collected or let go (advance used is already counted when it came in).
const isLater = (p: Payment) => p.kind === 'due' || p.kind === 'writeoff';
const gotLabel = (p: Payment) => (p.kind === 'writeoff' ? (p.note?.startsWith('Bad debt') ? 'Written off' : 'Let go (discount)') : `Received · ${MODE_LABEL[p.mode]}`);

function itemRows(i: CreditItem): Omit<LedgerRow, 'balance'>[] {
  const later = i.payments.filter(isLater);
  const rows: Omit<LedgerRow, 'balance'>[] = [{ at: i.at, day: i.day, what: i.type === 'opening' ? 'Old balance (before the app)' : `${i.label} on credit`, sub: i.what, given: i.given, got: 0 }];
  later.forEach(p => rows.push({ at: p.at, day: istDay(p.at), what: gotLabel(p), sub: `${i.label}${p.note && p.kind !== 'writeoff' ? ` · ${p.note}` : ''}`, given: 0, got: p.amount, ref: p.ref }));
  if (i.cancelled) {
    const left = roundMoney(i.given - later.reduce((s, p) => s + p.amount, 0));
    if (left > 0) rows.push({ at: i.at, day: i.day, what: `${i.label} cancelled`, sub: 'No longer owed', given: 0, got: left });
  }
  return rows;
}

// Oldest first, each row with the balance after it.
export function ledgerOf(a: Account): LedgerRow[] {
  const kept = a.entries.filter(e => e.kind === 'receipt' && !e.voided_at).flatMap(e => {
    const extra = roundMoney(e.amount - e.links.reduce((s, l) => s + l.amount, 0));
    return extra > 0 ? [{ at: e.at, day: istDay(e.at), what: 'Advance kept', sub: `Received · ${e.mode ? MODE_LABEL[e.mode] : ''}`, given: 0, got: extra, ref: e.id }] : [];
  });
  const rows = [...a.items.flatMap(itemRows), ...kept].sort((x, y) => x.at.localeCompare(y.at));
  let bal = 0;
  return rows.map(r => { bal = roundMoney(bal + r.given - r.got); return { ...r, balance: bal }; });
}

export const ledgerTotals = (rows: LedgerRow[]) => ({
  given: roundMoney(rows.reduce((s, r) => s + r.given, 0)),
  got: roundMoney(rows.reduce((s, r) => s + r.got, 0)),
});
