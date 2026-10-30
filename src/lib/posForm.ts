import type { SeasonalOrder, SeasonalOrderPayload } from '../hooks/useSeasonalOrders';
import type { SeasonalPreorder, SeasonalPreorderPayload } from '../hooks/useSeasonalPreorders';
import { CartLine, subtotalOf } from './cart';
import { DiscountType, discountValue, isValidPhone, cleanPhone } from './money';
import { Fulfillment, fulfillmentOf } from './preorders';

export type PosMode = 'bill' | 'preorder';
export type PayMode = 'cash' | 'upi';

export interface PosForm {
  mode: PosMode;
  occasion_id: string;
  customer_name: string;
  phone: string;
  address: string;
  discount: string;
  discount_type: DiscountType;
  payment: PayMode | 'unpaid';
  received: string;
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
  discount: '', discount_type: 'amount', payment: 'cash', received: '',
  delivery_date: mode === 'preorder' ? tomorrow() : '', fulfillment: 'pickup', advance: '', advance_mode: 'cash', notes: '', lines: [],
});

export const formFromOrder = (o: SeasonalOrder): PosForm => ({
  ...emptyForm('bill', o.occasion_id ?? ''),
  customer_name: o.customer_name === WALK_IN ? '' : o.customer_name,
  phone: o.phone ?? '', address: o.address ?? '',
  discount: o.discount_amount ? String(o.discount_amount) : '', discount_type: 'amount',
  payment: o.is_paid ? (o.payment_mode ?? 'cash') : 'unpaid',
  notes: o.notes ?? '', lines: o.items,
});

export const formFromPreorder = (p: SeasonalPreorder): PosForm => ({
  ...emptyForm('preorder', p.occasion_id ?? ''),
  customer_name: p.customer_name, phone: p.phone ?? '', address: p.address ?? '',
  discount: p.discount_amount ? String(p.discount_amount) : '', discount_type: 'amount',
  delivery_date: p.delivery_date ?? '', fulfillment: fulfillmentOf(p), advance: p.advance_paid ? String(p.advance_paid) : '',
  advance_mode: p.payment_mode ?? 'cash', notes: p.notes ?? '', lines: p.items,
});

export interface Totals { subtotal: number; discount: number; total: number; advance: number; balance: number; change: number }

export function totalsOf(f: PosForm): Totals {
  const subtotal = subtotalOf(f.lines);
  const discount = discountValue(subtotal, f.discount, f.discount_type);
  const total = Math.max(0, subtotal - discount);
  const advance = f.mode === 'preorder' ? Math.max(0, Number(f.advance) || 0) : 0;
  const received = Number(f.received) || 0;
  return {
    subtotal, discount, total, advance,
    balance: Math.max(0, total - advance),
    change: f.mode === 'bill' && f.payment === 'cash' && received > total ? received - total : 0,
  };
}

// First problem that blocks saving, or null.
export function validate(f: PosForm, t: Totals): string | null {
  if (!f.lines.length) return 'Add at least one item';
  const named = f.customer_name.trim();
  if (f.phone.trim() && !isValidPhone(f.phone)) return 'Phone must be a 10-digit mobile number';
  if (f.mode === 'bill' && f.payment === 'unpaid' && (!named || !f.phone.trim())) return 'Unpaid bills need the customer name and phone';
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

export const toOrderPayload = (f: PosForm, t: Totals, year: number): SeasonalOrderPayload => ({
  ...common(f, t),
  is_paid: f.payment !== 'unpaid',
  payment_mode: f.payment === 'unpaid' ? null : f.payment,
  year,
});

export const toPreorderPayload = (f: PosForm, t: Totals, year: number): SeasonalPreorderPayload => ({
  ...common(f, t),
  advance_paid: t.advance,
  payment_mode: t.advance > 0 ? f.advance_mode : null,
  delivery_date: f.delivery_date || undefined,
  fulfillment: f.fulfillment ?? 'pickup',
  status: 'pending',
  year,
});
