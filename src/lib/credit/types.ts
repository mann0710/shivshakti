import type { Payment, PayMode } from '../payments';

// Credit (pay later): rows of credit_accounts and credit_entries, and the shop-wide rules.

export type EntryKind = 'opening' | 'receipt' | 'writeoff' | 'promise' | 'reminder' | 'call' | 'note' | 'override';
export type CallOutcome = 'no_answer' | 'will_pay' | 'later' | 'disputed' | 'paid_elsewhere';
export type Lang = 'en' | 'hi';
export type ItemType = 'bill' | 'preorder' | 'opening';

// Part of a receipt or write-off that went to one bill, booking or old balance.
export interface Link { type: ItemType; id: string; amount: number }

export interface CreditEntry {
  id: string;
  phone: string;
  name: string;
  kind: EntryKind;
  amount: number;
  mode: PayMode | null;
  payments: Payment[];      // opening only
  links: Link[];            // receipt / writeoff
  due_date: string | null;  // opening: pay by
  promise_date: string | null;
  outcome: CallOutcome | null;
  note: string | null;
  by_email: string | null;
  at: string;
  created_at: string;
  voided_at: string | null;
}
export type CreditEntryPayload = Omit<CreditEntry, 'id' | 'created_at' | 'voided_at'>;

export interface CreditAccount {
  phone: string;
  name: string;
  credit_limit: number | null; // null: shop default
  no_credit: boolean;
  disputed: boolean;
  lang: Lang;
  note: string | null;
  updated_at?: string;
}

// Settings › Credit (stored in doc_settings.credit).
export interface CreditSettings {
  on: boolean;
  limit: number;          // 0: no limit
  over: 'warn' | 'block';
  block_days: number;     // 0: off
  pay_days: number;       // default pay-by
  remind_every: number;   // days between reminders
  lang: Lang;
  signature: boolean;     // signature line on credit receipts
}

export const DEFAULT_CREDIT: CreditSettings = {
  on: true, limit: 3000, over: 'warn', block_days: 0, pay_days: 7, remind_every: 3, lang: 'en', signature: true,
};

const num = (v: unknown, d: number, max: number) => { const n = Number(v); return Number.isFinite(n) && n >= 0 && n <= max ? Math.round(n) : d; };

// Saved values over the defaults, each one checked.
export function mergeCredit(raw: unknown): CreditSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<CreditSettings>;
  const d = DEFAULT_CREDIT;
  return {
    on: typeof r.on === 'boolean' ? r.on : d.on,
    limit: num(r.limit, d.limit, 10_000_000),
    over: r.over === 'block' ? 'block' : 'warn',
    block_days: num(r.block_days, d.block_days, 365),
    pay_days: num(r.pay_days, d.pay_days, 365) || d.pay_days,
    remind_every: num(r.remind_every, d.remind_every, 60) || d.remind_every,
    lang: r.lang === 'hi' ? 'hi' : 'en',
    signature: typeof r.signature === 'boolean' ? r.signature : d.signature,
  };
}

export const OUTCOMES: { id: CallOutcome; label: string }[] = [
  { id: 'no_answer', label: 'No answer' },
  { id: 'will_pay', label: 'Will pay' },
  { id: 'later', label: 'Call later' },
  { id: 'disputed', label: 'Says not owed' },
  { id: 'paid_elsewhere', label: 'Paid elsewhere' },
];
