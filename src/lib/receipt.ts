import { CartLine } from './cart';
import { formatLineSize } from './units';
import { inr, cleanPhone } from './money';
import { SHOP } from './shop';

export interface ReceiptData {
  kind: 'Bill' | 'Pre-Booking';
  number: string;
  date: string;
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
}

export const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

export const billNumber = (bill_no: number | null | undefined, id: string) =>
  bill_no ? String(bill_no) : id.slice(0, 6).toUpperCase();

// 80 mm thermal-printer friendly receipt; also prints fine on A4.
export function receiptHtml(r: ReceiptData): string {
  const rows = r.lines.map(l => `
    <tr><td colspan="3" class="n">${esc(l.item_name)} <small>${formatLineSize(l.weight, l.weight_unit)}</small></td></tr>
    <tr><td>${l.qty} × ${inr(l.price)}</td><td></td><td class="r">${inr(l.line_total)}</td></tr>`).join('');
  const line = (label: string, value: string, cls = '') => `<tr class="${cls}"><td colspan="2">${label}</td><td class="r">${value}</td></tr>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${r.kind} ${esc(r.number)}</title>
<style>
  @page { margin: 4mm; }
  body { font: 12px/1.35 'Courier New', monospace; width: 72mm; margin: 0 auto; color: #000; }
  h1 { font-size: 16px; text-align: center; margin: 0; } .c { text-align: center; } .r { text-align: right; white-space: nowrap; }
  table { width: 100%; border-collapse: collapse; } td { padding: 1px 0; vertical-align: top; }
  .n { font-weight: bold; padding-top: 4px; } small { font-weight: normal; }
  hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; } .t td { font-weight: bold; font-size: 14px; }
</style></head><body>
<h1>${esc(SHOP.name)}</h1>
<div class="c">${esc(SHOP.tagline)}<br>Ph: ${SHOP.phone}${r.gst_number ? `<br>GSTIN: ${esc(r.gst_number)}` : ''}</div>
<hr>
<div>${r.kind} #${esc(r.number)}<span style="float:right">${esc(r.date)}</span></div>
<div>${esc(r.customer_name)}${r.phone ? ` · ${esc(r.phone)}` : ''}</div>
${r.occasion ? `<div>Occasion: ${esc(r.occasion)}</div>` : ''}
${r.delivery_date ? `<div>Delivery: ${esc(r.delivery_date)}</div>` : ''}
<hr><table>${rows}</table><hr>
<table>
  ${line('Subtotal', inr(r.subtotal))}
  ${r.discount > 0 ? line('Discount', `-${inr(r.discount)}`) : ''}
  ${line('TOTAL', inr(r.total), 't')}
  ${line(esc(r.status), '')}
  ${r.balance && r.balance > 0 ? line('Balance due', inr(r.balance)) : ''}
</table>
${r.notes ? `<hr><div>Note: ${esc(r.notes)}</div>` : ''}
<hr><div class="c">Thank you! Visit again.</div>
</body></html>`;
}

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
