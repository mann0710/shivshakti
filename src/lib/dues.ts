import type { SeasonalOrder } from '../hooks/useSeasonalOrders';
import type { SeasonalPreorder } from '../hooks/useSeasonalPreorders';
import { billPayments, dueOf, paidOf } from './payments';
import { balanceOf } from './preorders';
import { cleanPhone } from './money';
import { roundMoney } from './units';

export const isCancelled = (o: Pick<SeasonalOrder, 'cancelled_at'>) => !!o.cancelled_at;
export const billPaid = (o: SeasonalOrder) => paidOf(billPayments(o));
export const billDue = (o: SeasonalOrder) => (isCancelled(o) ? 0 : dueOf(o.total_amount, billPayments(o)));
// A handed-over booking that was not fully paid; open bookings are tracked on the Pre-bookings tab.
export const bookingDue = (p: SeasonalPreorder) => (p.status === 'delivered' ? balanceOf(p) : 0);

// Test bills are the only ones that may be deleted; real ones are cancelled and keep their number.
export const isTestBill = (o: Pick<SeasonalOrder, 'customer_name' | 'notes'>) => /\btest\b/i.test(`${o.customer_name} ${o.notes ?? ''}`);

export interface Owed { amount: number; count: number }

// What a customer (by mobile) still owes on other bills and handed-over bookings.
export function owedBy(phone: string, orders: SeasonalOrder[], preorders: SeasonalPreorder[], exceptId?: string): Owed {
  const key = cleanPhone(phone);
  if (key.length < 10) return { amount: 0, count: 0 };
  const same = (p?: string) => cleanPhone(p ?? '') === key;
  const dues = [
    ...orders.filter(o => o.id !== exceptId && same(o.phone)).map(billDue),
    ...preorders.filter(p => p.id !== exceptId && same(p.phone)).map(bookingDue),
  ].filter(d => d > 0);
  return { amount: roundMoney(dues.reduce((s, d) => s + d, 0)), count: dues.length };
}

export const unpaidCount = (orders: SeasonalOrder[], preorders: SeasonalPreorder[]) =>
  orders.filter(o => billDue(o) > 0).length + preorders.filter(p => bookingDue(p) > 0).length;
