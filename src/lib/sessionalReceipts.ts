import type { SeasonalOrder } from '../hooks/useSeasonalOrders';
import type { SeasonalPreorder } from '../hooks/useSeasonalPreorders';
import { ReceiptData, billNumber, receiptHtml, printHtml, whatsAppText, openWhatsApp } from './receipt';
import { preorderSlipHtml } from './preorderSlip';
import { inr } from './money';
import { STATUS_LABEL, FULFILLMENT_LABEL, fulfillmentOf, advanceAtBooking, balanceOf, modeLabel } from './preorders';

const day = (iso: string) =>
  new Date(iso.includes('T') ? iso : `${iso}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export const orderReceipt = (o: SeasonalOrder, occasion?: string, gst?: string): ReceiptData => ({
  kind: 'Bill',
  number: billNumber(o.bill_no, o.id),
  date: day(o.created_at),
  customer_name: o.customer_name,
  phone: o.phone,
  occasion,
  lines: o.items,
  subtotal: o.subtotal,
  discount: o.discount_amount,
  total: o.total_amount,
  status: o.is_paid ? `Paid · ${(o.payment_mode ?? 'cash').toUpperCase()}` : 'Unpaid — please pay at the counter',
  balance: o.is_paid ? 0 : o.total_amount,
  notes: o.notes,
  gst_number: gst,
});

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
  },
});

export const formatDay = day;

export const shareReceipt = (r: ReceiptData) => {
  if (!r.phone) return false;
  openWhatsApp(r.phone, whatsAppText(r));
  return true;
};

// Bills print as 80 mm receipts; pre-bookings as a full A4 slip.
export const printReceipt = (r: ReceiptData) => printHtml(r.booking ? preorderSlipHtml(r) : receiptHtml(r));
