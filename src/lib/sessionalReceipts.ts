import type { SeasonalOrder } from '../hooks/useSeasonalOrders';
import type { SeasonalPreorder } from '../hooks/useSeasonalPreorders';
import { ReceiptData, billNumber, printHtml, whatsAppText, openWhatsApp } from './receipt';
import { preorderSlipHtml } from './docs/sweetsDocs';
import { docContext } from './docs/context';
import { inr } from './money';
import { roundMoney } from './units';
import { STATUS_LABEL, FULFILLMENT_LABEL, fulfillmentOf, advanceAtBooking, balanceOf, modeLabel, isPacked } from './preorders';
import { Payment, billPayments, paidBy, paidOf, modeOf, MODE_LABEL } from './payments';
import { billDue } from './dues';
import { SweetReceipt, PayLines, posBillHtml } from './thermalSlips';
import { SHOP } from './shop';
import { formatDateIST } from './ist';

const day = (iso: string) =>
  new Date(iso.includes('T') ? iso : `${iso}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const sumOf = (list: Payment[], pick: (p: Payment) => number) => roundMoney(list.reduce((s, p) => s + pick(p), 0));

// Cash handed over (with the change returned), UPI, and anything refunded.
export function payLines(list: Payment[]): PayLines {
  const cash = list.filter(p => p.mode === 'cash' && p.amount > 0);
  return {
    cash: sumOf(cash, p => p.tendered ?? p.amount),
    upi: paidBy(list.filter(p => p.amount > 0), 'upi'),
    returned: sumOf(cash, p => (p.tendered ? p.tendered - p.amount : 0)),
    refunded: Math.abs(paidOf(list.filter(p => p.amount < 0))),
  };
}

function billStatus(o: SeasonalOrder, list: Payment[]): string {
  if (o.cancelled_at) return 'Cancelled';
  const mode = modeOf(list);
  if (!billDue(o)) return `Paid · ${mode ? MODE_LABEL[mode] : 'Cash'}`;
  return paidOf(list) > 0 ? `Part paid ${inr(paidOf(list))}` : 'Unpaid — please pay at the counter';
}

export function orderReceipt(o: SeasonalOrder, occasion?: string, gst?: string): SweetReceipt {
  const list = billPayments(o);
  return {
    kind: 'Bill',
    number: billNumber(o.bill_no, o.id),
    date: day(o.created_at),
    time: new Date(o.created_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }),
    customer_name: o.customer_name,
    phone: o.phone,
    occasion,
    lines: o.items,
    subtotal: o.subtotal,
    discount: o.discount_amount,
    total: o.total_amount,
    status: billStatus(o, list),
    balance: billDue(o),
    notes: o.notes,
    gst_number: gst,
    pay: payLines(list),
    ...(o.cancelled_at ? { cancelled: o.cancel_reason ?? '' } : {}),
  };
}

export const preorderReceipt = (p: SeasonalPreorder, occasion?: string, gst?: string): ReceiptData => ({
  kind: 'Pre-Booking',
  number: p.id.slice(0, 6).toUpperCase(),
  date: day(p.created_at),
  customer_name: p.customer_name,
  phone: p.phone,
  occasion,
  lines: p.items,
  subtotal: p.subtotal,
  discount: p.discount_amount,
  total: p.total_amount,
  status: p.advance_paid > 0 ? `Paid ${inr(p.advance_paid)}` : 'No advance paid',
  balance: balanceOf(p),
  delivery_date: p.delivery_date ? day(p.delivery_date) : undefined,
  notes: p.notes,
  gst_number: gst,
  booking: {
    address: p.address,
    handover: FULFILLMENT_LABEL[fulfillmentOf(p)],
    status: STATUS_LABEL[p.status] ?? p.status,
    advance: advanceAtBooking(p),
    advance_mode: modeLabel(p.payment_mode),
    collected: p.balance_paid ?? 0,
    collected_mode: modeLabel(p.balance_mode),
    handed_over: p.delivered_at ? day(p.delivered_at) : undefined,
    packed: isPacked(p),
    given: p.status === 'delivered',
  },
});

export const formatDay = day;

export const shareReceipt = (r: ReceiptData) => {
  if (!r.phone) return false;
  openWhatsApp(r.phone, whatsAppText(r));
  return true;
};

// Bills print as 80 mm receipts; pre-bookings as a full A4 slip.
export const printReceipt = (r: SweetReceipt) => printHtml(r.booking ? preorderSlipHtml(r) : posBillHtml(r));

// Polite WhatsApp nudge with the amount due (and the UPI ID when one is saved).
export function reminderText(name: string, due: number, what: string): string {
  const upi = docContext().settings.upi_id.trim();
  return [
    `Namaste ${name},`,
    `A gentle reminder from ${SHOP.name}: *${inr(due)}* is due for ${what}.`,
    upi ? `You can pay by UPI to ${upi} or at the counter.` : 'You can pay at the counter.',
    `Thank you! ${SHOP.name}${SHOP.phone ? ` · ${SHOP.phone}` : ''}`,
  ].join('\n');
}

export const sendReminder = (phone: string, name: string, due: number, what: string) => openWhatsApp(phone, reminderText(name, due, what));

// Asks for an advance to confirm a pre-booking (no money taken yet).
export function advanceText(name: string, day: string, total: number): string {
  const upi = docContext().settings.upi_id.trim();
  return [`Namaste ${name},`, `Your sweets pre-booking for ${formatDateIST(day, 'd MMM')} comes to ${inr(total)}.`,
    `Please send an advance to confirm it${upi ? ` (UPI: ${upi})` : ''}.`, `Thank you! ${SHOP.name}`].join('\n');
}
