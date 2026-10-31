import { roundMoney } from './units';

export type PayMode = 'cash' | 'upi';
// sale: at the counter · due: collected later · advance / handover: pre-bookings · refund: handed back (negative).
export type PayKind = 'sale' | 'due' | 'advance' | 'handover' | 'refund';
export interface Payment { amount: number; mode: PayMode; at: string; kind: PayKind; tendered?: number }
export type PayChoice = PayMode | 'split' | 'unpaid';

// Fields a bill or pre-booking needs to fall back on before the ledger existed.
interface BillLike { payments?: Payment[] | null; is_paid: boolean; total_amount: number; payment_mode?: string | null; created_at: string; cancelled_at?: string | null }
interface BookingLike { payments?: Payment[] | null; advance_paid: number; balance_paid?: number; payment_mode?: string | null; balance_mode?: string | null; delivered_at?: string | null; delivery_date?: string; created_at: string }

const time = (iso: string) => Date.parse(iso) || 0;
const asMode = (m?: string | null): PayMode => (m === 'upi' ? 'upi' : 'cash');
const total = (list: Payment[]) => roundMoney(list.reduce((s, p) => s + (Number(p.amount) || 0), 0));

export const paidOf = total;
export const paidBy = (list: Payment[], mode: PayMode) => total(list.filter(p => p.mode === mode));
export const dueOf = (amount: number, list: Payment[]) => Math.max(0, roundMoney(amount - paidOf(list)));
export const lastPaidAt = (list: Payment[]) => (list.length ? list.reduce((a, b) => (time(b.at) > time(a.at) ? b : a)).at : null);

// One mode, both, or none.
export function modeOf(list: Payment[]): PayMode | 'mixed' | null {
  const modes = Array.from(new Set(list.filter(p => p.amount > 0).map(p => p.mode)));
  return modes.length > 1 ? 'mixed' : modes[0] ?? null;
}

export const MODE_LABEL: Record<PayMode | 'mixed', string> = { cash: 'Cash', upi: 'UPI', mixed: 'Cash + UPI' };

// The bill's ledger, or one payment of the full total for paid bills made before it.
export function billPayments(o: BillLike): Payment[] {
  if (o.payments?.length) return o.payments;
  return o.is_paid && !o.cancelled_at && o.total_amount > 0
    ? [{ amount: o.total_amount, mode: asMode(o.payment_mode), at: o.created_at, kind: 'sale' }]
    : [];
}

// The booking's ledger, or its advance and hand-over money rebuilt from the older columns.
export function preorderPayments(p: BookingLike): Payment[] {
  if (p.payments?.length) return p.payments;
  const after = p.balance_paid ?? 0;
  const advance = roundMoney(p.advance_paid - after);
  const out: Payment[] = [];
  if (advance > 0) out.push({ amount: advance, mode: asMode(p.payment_mode), at: p.created_at, kind: 'advance' });
  if (after > 0) {
    const at = p.delivered_at ?? (p.delivery_date ? `${p.delivery_date}T00:00:00Z` : p.created_at);
    out.push({ amount: after, mode: asMode(p.balance_mode ?? p.payment_mode), at, kind: 'handover' });
  }
  return out;
}

// One sweets payment as received (refunds negative), with when its bill or booking was made.
export interface MoneyIn extends Payment { source: 'bill' | 'booking'; madeAt: string }

// Every payment on these bills and bookings, timed by when the money came in.
export const moneyIn = (bills: BillLike[], bookings: BookingLike[]): MoneyIn[] => [
  ...bills.flatMap(o => billPayments(o).map(p => ({ ...p, source: 'bill' as const, madeAt: o.created_at }))),
  ...bookings.flatMap(b => preorderPayments(b).map(p => ({ ...p, source: 'booking' as const, madeAt: b.created_at }))),
];

// Columns kept in step with a bill's ledger; a cancelled bill has nothing left to collect.
export const billLedger = (amount: number, payments: Payment[], cancelled = false) => {
  const paid = paidOf(payments);
  return { payments, paid_amount: paid, paid_at: lastPaidAt(payments), is_paid: cancelled || paid >= amount, payment_mode: modeOf(payments) };
};

// Columns kept in step with a booking's ledger: advance_paid holds everything received.
export const preorderLedger = (payments: Payment[]) => {
  const advances = payments.filter(p => p.kind === 'advance');
  const later = payments.filter(p => p.kind !== 'advance');
  return {
    payments,
    advance_paid: paidOf(payments),
    payment_mode: advances.length ? advances[advances.length - 1].mode : null,
    balance_paid: paidOf(later),
    balance_mode: later.length ? later[later.length - 1].mode : null,
  };
};

export interface CounterPay { cash: number; upi: number; tendered: number; change: number }
const amountOf = (text: string) => Math.max(0, Number(text) || 0);

// What is due now, split by the chosen way to pay; cash handed over gives the change.
export function splitPay(choice: PayChoice, due: number, cashPart: string, handed: string): CounterPay {
  if (due <= 0 || choice === 'unpaid') return { cash: 0, upi: 0, tendered: 0, change: 0 };
  if (choice === 'upi') return { cash: 0, upi: due, tendered: 0, change: 0 };
  if (choice === 'split') {
    const cash = Math.min(due, amountOf(cashPart));
    return { cash, upi: roundMoney(due - cash), tendered: 0, change: 0 };
  }
  const given = amountOf(handed);
  return given > due ? { cash: due, upi: 0, tendered: given, change: roundMoney(given - due) } : { cash: due, upi: 0, tendered: 0, change: 0 };
}

export const payEntries = (pay: CounterPay, at: string, kind: PayKind = 'sale'): Payment[] => [
  ...(pay.cash > 0 ? [{ amount: pay.cash, mode: 'cash' as const, at, kind, ...(pay.tendered ? { tendered: pay.tendered } : {}) }] : []),
  ...(pay.upi > 0 ? [{ amount: pay.upi, mode: 'upi' as const, at, kind }] : []),
];

// Money handed back as negative entries: cash first, then UPI.
export function refundEntries(paid: Payment[], amount: number, at: string): Payment[] {
  const cash = Math.min(amount, Math.max(0, paidBy(paid, 'cash')));
  const upi = roundMoney(amount - cash);
  return [
    ...(cash > 0 ? [{ amount: -cash, mode: 'cash' as const, at, kind: 'refund' as const }] : []),
    ...(upi > 0 ? [{ amount: -upi, mode: 'upi' as const, at, kind: 'refund' as const }] : []),
  ];
}

// A changed booking advance: the difference is received (or handed back) now.
export function withAdvance(payments: Payment[], advance: number, mode: PayMode, at: string): Payment[] {
  const delta = roundMoney(advance - paidOf(payments.filter(p => p.kind === 'advance')));
  return delta ? [...payments, { amount: delta, mode, at, kind: 'advance' }] : payments;
}

// "Exact" plus the next round amounts a customer is likely to hand over.
export function cashChips(due: number): number[] {
  if (due <= 0) return [];
  const up = [10, 50, 100, 500, 1000, 2000].map(n => Math.ceil(due / n) * n).filter(v => v > due);
  return [due, ...Array.from(new Set(up)).sort((a, b) => a - b).slice(0, 3)];
}
