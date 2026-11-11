import type { SeasonalOrder } from '../../hooks/useSeasonalOrders';
import type { SeasonalPreorder } from '../../hooks/useSeasonalPreorders';
import { Payment, billPayments, preorderPayments, dueOf, paidOf } from '../payments';
import { billDue, bookingDue, isCancelled } from '../dues';
import { handedOverOn, istDay } from '../preorders';
import { billNumber } from '../receipt';
import { phoneKey } from '../people';
import { addDays, daysBetween } from './dates';
import { CreditEntry, ItemType } from './types';

// One bill, handed-over booking or old balance that a customer was given on credit.
export interface CreditItem {
  type: ItemType;
  id: string;
  phone: string;
  name: string;
  label: string;       // "Bill #12", "Pre-booking", "Old balance"
  what: string;        // first items, or the note
  day: string;         // given on (YYYY-MM-DD)
  at: string;          // given at (ISO), for ordering
  payBy: string;
  given: number;       // put on credit (total less what was paid there and then)
  total: number;
  payments: Payment[];
  due: number;
  cancelled: boolean;
}

const firstItems = (items?: { item_name: string }[]) => Array.from(new Set((items ?? []).map(i => i.item_name))).slice(0, 2).join(', ') || 'Sweets';
const upfront = (list: Payment[], kinds: Payment['kind'][]) => paidOf(list.filter(p => kinds.includes(p.kind)));

// A bill was on credit when the counter took less than the total.
export function billItem(o: SeasonalOrder, payDays: number): CreditItem | null {
  const list = billPayments(o);
  const given = Math.max(0, o.total_amount - upfront(list, ['sale', 'refund']));
  const phone = phoneKey(o.phone);
  if (!phone || given <= 0) return null;
  const day = istDay(o.created_at);
  return {
    type: 'bill', id: o.id, phone, name: o.customer_name, label: `Bill #${billNumber(o.bill_no, o.id)}`, what: firstItems(o.items),
    day, at: o.created_at, payBy: o.due_date || addDays(day, payDays), given, total: o.total_amount, payments: list, due: billDue(o), cancelled: isCancelled(o),
  };
}

// A booking handed over with money still to pay.
export function bookingItem(p: SeasonalPreorder, payDays: number): CreditItem | null {
  const day = handedOverOn(p);
  const phone = phoneKey(p.phone);
  if (!day || !phone) return null;
  const list = preorderPayments(p);
  const given = Math.max(0, p.total_amount - upfront(list, ['advance', 'handover', 'refund']));
  if (given <= 0) return null;
  return {
    type: 'preorder', id: p.id, phone, name: p.customer_name, label: 'Pre-booking', what: firstItems(p.items),
    day, at: p.delivered_at || `${day}T12:00:00+05:30`, payBy: addDays(day, payDays), given, total: p.total_amount, payments: list, due: bookingDue(p), cancelled: false,
  };
}

// Old balance from the paper register.
export const openingItem = (e: CreditEntry, payDays: number): CreditItem => {
  const day = istDay(e.at);
  return {
    type: 'opening', id: e.id, phone: e.phone, name: e.name, label: 'Old balance', what: e.note || 'From the register',
    day, at: e.at, payBy: e.due_date || addDays(day, payDays), given: e.amount, total: e.amount, payments: e.payments ?? [],
    due: e.voided_at ? 0 : dueOf(e.amount, e.payments ?? []), cancelled: !!e.voided_at,
  };
};

// Every credit item, oldest first.
export function creditItems(orders: SeasonalOrder[], preorders: SeasonalPreorder[], entries: CreditEntry[], payDays: number): CreditItem[] {
  return [
    ...orders.map(o => billItem(o, payDays)),
    ...preorders.map(p => bookingItem(p, payDays)),
    ...entries.filter(e => e.kind === 'opening').map(e => openingItem(e, payDays)),
  ].filter((x): x is CreditItem => !!x).sort((a, b) => a.at.localeCompare(b.at));
}

export const ageOf = (x: Pick<CreditItem, 'day'>, today: string) => Math.max(0, daysBetween(x.day, today));
export const lateBy = (x: Pick<CreditItem, 'payBy'>, today: string) => Math.max(0, daysBetween(x.payBy, today));

// Age buckets shared by the Credit tab and the report.
export const AGES = ['0–7 days', '8–30 days', '31–60 days', 'Over 60 days'] as const;
export const ageBucket = (days: number) => (days <= 7 ? 0 : days <= 30 ? 1 : days <= 60 ? 2 : 3);
