import React, { useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import { Invoice, Payment } from '../../types';
import { Quotation } from '../../hooks/useQuotations';
import { invoiceDoc } from '../../lib/docs/invoiceDoc';
import { downloadDoc, printDoc, shareDoc } from '../../lib/docs/output';
import { formatDateIST } from '../../lib/ist';
import { inr } from '../../lib/money';
import { openWhatsApp } from '../../lib/receipt';
import { sendReminder } from '../../lib/sessionalReceipts';
import { SHOP } from '../../lib/shop';
import { modeLabel } from './PaymentFields';

// WhatsApp to the saved number, else let WhatsApp ask who to send to.
export const whatsApp = (phone: string | undefined, text: string) => {
  if ((phone ?? '').replace(/\D/g, '').length >= 10) return openWhatsApp(phone!, text);
  const w = window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  if (w) w.opener = null;
  return !!w;
};

const summaryText = (inv: Invoice, payments: Payment[]) => {
  const b = inv.booking;
  const extras = (inv.extra_charges ?? []).filter(e => e.amount > 0).map(e => `${e.description}: ${inr(e.amount)}`);
  const paid = payments.map(p => `  ${inr(p.amount)} ${modeLabel(p.payment_mode)} on ${formatDateIST(p.payment_date, 'd MMM yyyy')}`);
  return [
    `Namaste ${b?.customer?.name ?? ''},`, '', `Your invoice *${inv.invoice_number}* is ready.`,
    b ? `${b.event_type} · ${formatDateIST(b.event_date, 'd MMM yyyy')}${b.venue ? ` · ${b.venue}` : ''}` : '', '',
    `Meals: ${inr(inv.subtotal)}`, ...extras,
    inv.transportation_charge > 0 ? `Transport: ${inr(inv.transportation_charge)}` : '',
    inv.discount_amount > 0 ? `Discount: -${inr(inv.discount_amount)}` : '',
    inv.gst_amount > 0 ? `GST ${inv.gst_rate}%: ${inr(inv.gst_amount)}` : '',
    `*Total: ${inr(inv.total_amount)}*`, '',
    ...(paid.length ? ['Payments received:', ...paid] : []),
    `Balance: *${inr(inv.balance_due)}*`, '', `Thank you! ${SHOP.name}`,
  ].filter((l, i, a) => l !== '' || (i > 0 && a[i - 1] !== '')).join('\n');
};

// Preview PDF and the "Send…" sheet: PDF, payment reminder, summary text or download.
export function useInvoiceSend(inv: Invoice, quote: Quotation | undefined, payments: Payment[]) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const phone = inv.booking?.customer?.phone;
  const name = inv.booking?.customer?.name ?? 'Customer';
  const make = () => invoiceDoc(inv, quote, payments);
  const run = async (job: () => unknown) => {
    setBusy(true);
    try { await job(); setOpen(false); } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not send'); } finally { setBusy(false); }
  };
  const due = inv.balance_due > 0 ? inr(inv.balance_due) : 'Nil (fully paid)';
  const options: [string, string, () => unknown][] = [
    ['Invoice PDF on WhatsApp', `Saves the PDF and opens ${name}'s chat`, () => shareDoc(make, `Namaste ${name},\nInvoice ${inv.invoice_number}\nTotal: ${inr(inv.total_amount)}\nBalance due: ${due}\n\n${SHOP.name}`, phone)],
    ...(inv.balance_due > 0 ? [['Payment reminder', `Asks for the ${inr(inv.balance_due)} still due`, () => (phone ? sendReminder(phone, name, inv.balance_due, `invoice ${inv.invoice_number}`) : whatsApp(phone, `${inr(inv.balance_due)} is due for invoice ${inv.invoice_number}.`))] as [string, string, () => unknown]] : []),
    ['Invoice as a message', 'Totals and payments as WhatsApp text', () => whatsApp(phone, summaryText(inv, payments))],
    ['Download PDF', 'To print or email', () => downloadDoc(make)],
  ];
  const ui = open && (
    <Modal title={`Send ${inv.invoice_number}`} onClose={() => setOpen(false)} width={460} busy={busy}>
      <div className="mx-dlg">
        <p className="mx-dlg-sub">The PDF lists every payment and a UPI QR for the balance.</p>
        <div className="mx-cards">
          {options.map(([title, line, job]) => (
            <button key={title} type="button" className="mx-rcard" style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }} disabled={busy} onClick={() => run(job)}>
              <span><b>{title}</b><small>{line}</small></span><span aria-hidden="true">›</span>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
  return { preview: () => printDoc(make), openSend: () => setOpen(true), ui };
}
