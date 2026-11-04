import type { SeasonalOrder, SeasonalOrderItem } from '../hooks/useSeasonalOrders';
import type { SeasonalPreorder } from '../hooks/useSeasonalPreorders';
import { Payment, PayMode, billPayments, preorderPayments, paidOf, dueOf, modeOf } from './payments';
import { billNumber } from './receipt';
import { istDay, DateSpan, STATUS_LABEL } from './preorders';
import { cleanPhone } from './money';
import { roundMoney } from './units';

// Counter bills and pre-bookings as one list: each is a sale with its own invoice.
export interface BillRow {
  id: string;
  kind: 'bill' | 'booking';
  number: string;
  name: string;
  phone: string;
  address?: string;
  // Bill date for counter bills; hand-over (else pickup) date for pre-bookings.
  day: string;
  at: string;
  occasion_id?: string;
  lines: SeasonalOrderItem[];
  subtotal: number;
  discount: number;
  total: number;
  payments: Payment[];
  paid: number;
  due: number;
  mode: PayMode | 'mixed' | null;
  cancelled: boolean;
  cancelReason?: string;
  stage?: string;
  pickup?: string;
  notes?: string;
  order?: SeasonalOrder;
  booking?: SeasonalPreorder;
}

const money = (o: { total: number; payments: Payment[]; cancelled: boolean }) => ({
  paid: paidOf(o.payments),
  due: o.cancelled ? 0 : dueOf(o.total, o.payments),
  mode: modeOf(o.payments.filter(p => p.amount > 0)),
});

export function billRow(o: SeasonalOrder): BillRow {
  const base = { total: o.total_amount, payments: billPayments(o), cancelled: !!o.cancelled_at };
  return {
    ...base, ...money(base), id: o.id, kind: 'bill', number: billNumber(o.bill_no, o.id), name: o.customer_name, phone: o.phone, address: o.address,
    day: istDay(o.created_at), at: o.created_at, occasion_id: o.occasion_id, lines: o.items, subtotal: o.subtotal, discount: o.discount_amount,
    cancelReason: o.cancel_reason ?? undefined, notes: o.notes, order: o,
  };
}

export function bookingRow(p: SeasonalPreorder): BillRow {
  const base = { total: p.total_amount, payments: preorderPayments(p), cancelled: p.status === 'cancelled' };
  return {
    ...base, ...money(base), id: p.id, kind: 'booking', number: p.id.slice(0, 6).toUpperCase(), name: p.customer_name, phone: p.phone, address: p.address,
    day: p.delivered_at ? istDay(p.delivered_at) : p.delivery_date || istDay(p.created_at), at: p.created_at, occasion_id: p.occasion_id,
    lines: p.items, subtotal: p.subtotal, discount: p.discount_amount, stage: STATUS_LABEL[p.status], pickup: p.delivery_date, notes: p.notes, booking: p,
  };
}

// Newest first.
export const billRows = (orders: SeasonalOrder[], preorders: SeasonalPreorder[]): BillRow[] =>
  [...orders.map(billRow), ...preorders.map(bookingRow)].sort((a, b) => b.day.localeCompare(a.day) || b.at.localeCompare(a.at));

export type BillType = 'all' | 'bill' | 'booking';
export type BillPay = 'all' | 'paid' | 'unpaid' | 'cancelled';
export interface BillFilter { span: DateSpan; occasion: string; type: BillType; pay: BillPay; mode: 'all' | PayMode | 'mixed'; q: string }
export const NO_FILTER: BillFilter = { span: { from: '', to: '' }, occasion: '', type: 'all', pay: 'all', mode: 'all', q: '' };

const payOk = (r: BillRow, pay: BillPay) =>
  pay === 'all' || (pay === 'cancelled' ? r.cancelled : !r.cancelled && (pay === 'paid' ? r.due === 0 : r.due > 0));

// Name or bill number contains the text; 3+ digits also match the mobile.
export const matchesBill = (r: BillRow, q: string) => {
  const t = q.trim().toLowerCase().replace(/^#/, '');
  const digits = cleanPhone(q);
  return !t || r.name.toLowerCase().includes(t) || r.number.toLowerCase() === t || (digits.length >= 3 && r.phone.includes(digits));
};

export const filterBills = (rows: BillRow[], f: BillFilter) => rows.filter(r =>
  (!f.span.from || r.day >= f.span.from) && (!f.span.to || r.day <= f.span.to)
  && (!f.occasion || r.occasion_id === f.occasion)
  && (f.type === 'all' || r.kind === f.type)
  && payOk(r, f.pay)
  && (f.mode === 'all' || r.mode === f.mode)
  && matchesBill(r, f.q));

// Cancelled sales count but add no money.
export function billTotals(rows: BillRow[]) {
  const live = rows.filter(r => !r.cancelled);
  const sum = (pick: (r: BillRow) => number) => roundMoney(live.reduce((s, r) => s + pick(r), 0));
  return { count: rows.length, cancelled: rows.length - live.length, billed: sum(r => r.total), received: sum(r => r.paid), due: sum(r => r.due) };
}
