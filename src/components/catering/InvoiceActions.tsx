import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Invoice, Payment } from '../../types';
import { Quotation } from '../../hooks/useQuotations';
import { invoiceDoc } from '../../lib/docs/invoiceDoc';
import { downloadDoc, shareDoc } from '../../lib/docs/output';
import { formatDateIST } from '../../lib/ist';
import { waNumber } from '../../lib/quoteMath';
import { inr } from '../../lib/money';
import { btnGhost, btnPrimary } from './InvoiceUi';

interface Props { invoice: Invoice; quotation?: Quotation; payments: Payment[] }

// WhatsApp summary, PDF share and PDF download for one invoice.
const InvoiceActions: React.FC<Props> = ({ invoice: selected, quotation, payments: paymentHistory }) => {
  const [sharing, setSharing] = useState(false);
  const customer = selected.booking?.customer;

  const make = () => invoiceDoc(selected, quotation, paymentHistory);
  const downloadPDF = () => downloadDoc(make);

  const sharePDF = async () => {
    setSharing(true);
    try {
      const due = selected.balance_due > 0 ? inr(selected.balance_due) : 'Nil (fully paid)';
      const text = `Dear ${customer?.name || 'Customer'},\nInvoice ${selected.invoice_number}\nTotal: ${inr(selected.total_amount)}\nBalance due: ${due}\n\nShiv Shakti Caterers`;
      const res = await shareDoc(make, text, customer?.phone);
      if (res === 'whatsapp') toast.success('PDF downloaded. Attach it in the WhatsApp chat.');
    } catch (e: any) { toast.error(e?.message || 'Could not share PDF'); }
    finally { setSharing(false); }
  };

  const sendWhatsApp = () => {
    const booking = selected.booking;
    const phone = waNumber(customer?.phone);
    const itemLines = (selected.line_items || []).map(i => `  · ${i.description}`).join('\n') || '  · Catering service';
    const extraLines = (selected.extra_charges || []).filter(e => e.amount > 0)
      .map(e => `${e.description}: +₹${e.amount.toLocaleString()}`).join('\n');
    const discountLine = selected.discount_amount > 0 ? `Discount: -₹${selected.discount_amount.toLocaleString()}\n` : '';
    const gstLine = selected.gst_rate > 0 ? `GST @${selected.gst_rate}%: ₹${selected.gst_amount.toLocaleString()}\n` : '';
    const transportLine = (selected.transportation_charge || 0) > 0 ? `Transportation: +₹${selected.transportation_charge.toLocaleString()}\n` : '';
    const payHistLines = paymentHistory.length
      ? paymentHistory.map(p => `  · ₹${p.amount.toLocaleString()} (${p.payment_type}, ${p.payment_mode}) on ${formatDateIST(p.payment_date, 'dd-MM-yyyy')}`).join('\n')
      : '  None yet';
    const msg = encodeURIComponent(
      `Dear ${customer?.name},\n\nYour invoice *${selected.invoice_number}* is ready.\n\n` +
      `*Event:* ${booking?.event_type} · ${formatDateIST(booking?.event_date, 'dd-MM-yyyy')}\n` +
      `*Venue:* ${booking?.venue || '—'} · *Guests:* ${booking?.guest_count}\n\n` +
      `*Menu Items:*\n${itemLines}\n\n` +
      (extraLines ? `*Extra Charges:*\n${extraLines}\n\n` : '') +
      `*Invoice Summary*\nSubtotal: ₹${selected.subtotal.toLocaleString()}\n${gstLine}${transportLine}${discountLine}*Total: ₹${selected.total_amount.toLocaleString()}*\n\n` +
      `*Payments:*\n${payHistLines}\n\nPaid: ₹${selected.advance_paid.toLocaleString()} | Balance: ₹${selected.balance_due.toLocaleString()}\n\nThank you!\nShiv Shakti Caterers`
    );
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
  };

  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
      <button type="button" style={{ ...btnGhost, ...grow }} onClick={sendWhatsApp}>📱 WhatsApp</button>
      <button type="button" style={{ ...btnGhost, ...grow, opacity: sharing ? 0.6 : 1 }} onClick={sharePDF} disabled={sharing}>
        {sharing ? 'Preparing…' : '📤 Share PDF'}
      </button>
      <button type="button" style={{ ...btnPrimary, ...grow }} onClick={downloadPDF}>⬇ PDF</button>
    </div>
  );
};

const grow: React.CSSProperties = { flex: '1 1 90px', fontSize: 12, whiteSpace: 'nowrap' };

export default InvoiceActions;
