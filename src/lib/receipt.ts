import { CartLine } from './cart';
import { formatLineSize } from './units';
import { inr, cleanPhone } from './money';
import { SHOP } from './shop';

export interface ReceiptData {
  kind: 'Bill' | 'Pre-Booking';
  number: string;
  date: string;
  time?: string;
  customer_name: string;
  phone?: string;
  occasion?: string;
  lines: CartLine[];
  subtotal: number;
  discount: number;
  total: number;
  status: string;          // "Paid · CASH", "Unpaid", "Advance ₹500"
  balance?: number;
  delivery_date?: string;
  notes?: string;
  gst_number?: string;
  booking?: BookingInfo; // pre-bookings print a full A4 slip
}

export interface BookingInfo {
  address?: string;
  handover: string;        // "Pickup from shop" / "Home delivery"
  status: string;
  advance: number;
  advance_mode: string;
  collected: number;       // paid at hand-over
  collected_mode: string;
  handed_over?: string;
  packed: boolean;
  given: boolean;
}

export const billNumber = (bill_no: number | null | undefined, id: string) =>
  bill_no ? String(bill_no) : id.slice(0, 6).toUpperCase();

// Prints HTML through a hidden iframe so the app page stays put.
export function printHtml(html: string) {
  const frame = document.createElement('iframe');
  Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  document.body.appendChild(frame);
  const doc = frame.contentWindow?.document;
  if (!doc) return;
  doc.open(); doc.write(html); doc.close();
  setTimeout(() => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 1000);
  }, 250);
}


export function whatsAppText(r: ReceiptData): string {
  return [
    `*${SHOP.name} — ${r.kind} #${r.number}*`,
    `Customer: ${r.customer_name}`,
    `Date: ${r.date}`,
    r.occasion ? `Occasion: ${r.occasion}` : '',
    r.delivery_date ? `${r.booking?.handover ?? 'Delivery'}: ${r.delivery_date}` : '',
    r.booking?.address ? `Address: ${r.booking.address}` : '',
    '',
    '*Items:*',
    ...r.lines.map(l => `• ${l.item_name} (${formatLineSize(l.weight, l.weight_unit)}) ×${l.qty} = ${inr(l.line_total)}`),
    '',
    `Subtotal: ${inr(r.subtotal)}`,
    r.discount > 0 ? `Discount: -${inr(r.discount)}` : '',
    `*Total: ${inr(r.total)}*`,
    r.status,
    r.balance && r.balance > 0 ? `Balance due: ${inr(r.balance)}` : '',
    '',
    `Thank you! ${SHOP.name} · ${SHOP.phone}`,
  ].filter((s, i, a) => s !== '' || (a[i - 1] !== '' && i > 0)).join('\n');
}

export function openWhatsApp(phone: string, text: string) {
  const digits = cleanPhone(phone);
  window.open(`https://wa.me/91${digits}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}
