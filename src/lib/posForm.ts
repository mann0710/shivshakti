import type { SeasonalOrder, SeasonalOrderPayload } from '../hooks/useSeasonalOrders';
import type { SeasonalPreorder, SeasonalPreorderPayload } from '../hooks/useSeasonalPreorders';
import { CartLine, subtotalOf } from './cart';
import { DiscountType, discountValue, isValidPhone, cleanPhone } from './money';
import { Fulfillment, fulfillmentOf } from './preorders';
import { roundMoney } from './units';
import {
  PayMode, PayChoice, Payment, CounterPay, billPayments, paidOf, dueOf, modeOf,
  splitPay, payEntries, refundEntries, billLedger, preorderLedger, withAdvance,
} from './payments';

export type { PayMode, PayChoice };
export type PosMode = 'bill' | 'preorder';

export interface PosForm {
  mode: PosMode;
  occasion_id: string;
  customer_name: string;
  phone: string;
  address: string;
  discount: string;
  discount_type: DiscountType;
  payment: PayChoice;
  received: string;      // cash handed over, for the change
  cash_part: string;     // Cash + UPI: the cash share
  paid_before?: number;  // editing a bill: already received on it
  delivery_date: string;
  fulfillment?: Fulfillment; // older saved drafts lack it → pickup
  advance: string;
  advance_mode: PayMode;
  notes: string;
  lines: CartLine[];
}

export const WALK_IN = 'Walk-in';

const tomorrow = () => {
  const d = new Date(Date.now() + 86400000);
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
};

export const emptyForm = (mode: PosMode = 'bill', occasion_id = ''): PosForm => ({
  mode, occasion_id, customer_name: '', phone: '', address: '',
  discount: '', discount_type: 'amount', payment: 'cash', received: '', cash_part: '', paid_before: 0,
  delivery_date: mode === 'preorder' ? tomorrow() : '', fulfillment: 'pickup', advance: '', advance_mode: 'cash', notes: '', lines: [],
});

// Editing a bill: the way to pay applies to whatever is still due.
export const formFromOrder = (o: SeasonalOrder): PosForm => {
  const paid = billPayments(o);
  const mode = modeOf(paid);
  return {
    ...emptyForm('bill', o.occasion_id ?? ''),
    customer_name: o.customer_name === WALK_IN ? '' : o.customer_name,
    phone: o.phone ?? '', address: o.address ?? '',
    discount: o.discount_amount ? String(o.discount_amount) : '', discount_type: 'amount',
    payment: dueOf(o.total_amount, paid) > 0 ? 'unpaid' : mode === 'upi' ? 'upi' : 'cash',
    paid_before: paidOf(paid),
    notes: o.notes ?? '', lines: o.items,
  };
};

export const formFromPreorder = (p: SeasonalPreorder): PosForm => ({
  ...emptyForm('preorder', p.occasion_id ?? ''),
  customer_name: p.customer_name, phone: p.phone ?? '', address: p.address ?? '',
  discount: p.discount_amount ? String(p.discount_amount) : '', discount_type: 'amount',
  delivery_date: p.delivery_date ?? '', fulfillment: fulfillmentOf(p), advance: p.advance_paid ? String(p.advance_paid) : '',
  advance_mode: p.payment_mode ?? 'cash', notes: p.notes ?? '', lines: p.items,
});

export interface Totals {
  subtotal: number; discount: number; total: number; advance: number; balance: number;
  due: number;      // bill: to pay now
  refund: number;   // bill edit: to hand back
  pay: CounterPay;
  change: number;
}

export function totalsOf(f: PosForm): Totals {
  const subtotal = subtotalOf(f.lines);
  const discount = discountValue(subtotal, f.discount, f.discount_type);
  const total = Math.max(0, subtotal - discount);
  const advance = f.mode === 'preorder' ? Math.max(0, Number(f.advance) || 0) : 0;
  const before = f.mode === 'bill' ? f.paid_before ?? 0 : 0;
  const due = Math.max(0, roundMoney(total - before));
  const pay = f.mode === 'bill' ? splitPay(f.payment, due, f.cash_part, f.received) : splitPay('unpaid', 0, '', '');
  return {
    subtotal, discount, total, advance,
    balance: Math.max(0, total - advance),
    due, refund: Math.max(0, roundMoney(before - total)), pay, change: pay.change,
  };
}

// First problem that blocks saving, or null.
export function validate(f: PosForm, t: Totals): string | null {
  if (!f.lines.length) return 'Add at least one item';
  const named = f.customer_name.trim();
  if (f.phone.trim() && !isValidPhone(f.phone)) return 'Phone must be a 10-digit mobile number';
  if (f.mode === 'bill' && f.payment === 'unpaid' && t.due > 0 && (!named || !f.phone.trim())) return 'Unpaid bills need the customer name and phone';
  if (f.mode === 'bill' && f.payment === 'split' && t.due > 0 && t.pay.cash <= 0) return 'Type the cash part, or choose UPI';
  if (f.mode === 'preorder') {
    if (!named || !f.phone.trim()) return 'Pre-bookings need the customer name and phone';
    if (!f.delivery_date) return f.fulfillment === 'delivery' ? 'Pick a delivery date' : 'Pick a pickup date';
    if (f.fulfillment === 'delivery' && !f.address.trim()) return 'Home delivery needs the address';
    if (t.advance > t.total) return 'Advance cannot be more than the total';
  }
  return null;
}

const common = (f: PosForm, t: Totals) => ({
  occasion_id: f.occasion_id || undefined,
  customer_name: f.customer_name.trim() || WALK_IN,
  phone: f.phone.trim() ? cleanPhone(f.phone) : '',
  address: f.address.trim() || undefined,
  items: f.lines,
  subtotal: t.subtotal,
  discount_amount: t.discount,
  discount_type: 'amount' as DiscountType,
  total_amount: t.total,
  notes: f.notes.trim() || undefined,
});

const nowIso = () => new Date().toISOString();

// New bill, or an edit on top of what was already paid (extra collected or change handed back).
export function toOrderPayload(f: PosForm, t: Totals, year: number, prior: Payment[] = [], at = nowIso()): SeasonalOrderPayload {
  const payments = [...prior, ...payEntries(t.pay, at), ...(t.refund > 0 ? refundEntries(prior, t.refund, at) : [])];
  return { ...common(f, t), ...billLedger(t.total, payments), year };
}

export function toPreorderPayload(f: PosForm, t: Totals, year: number, prior: Payment[] = [], at = nowIso()): SeasonalPreorderPayload {
  return {
    ...common(f, t),
    ...preorderLedger(withAdvance(prior, t.advance, f.advance_mode, at)),
    delivery_date: f.delivery_date || undefined,
    fulfillment: f.fulfillment ?? 'pickup',
    status: 'pending',
    year,
  };
}
