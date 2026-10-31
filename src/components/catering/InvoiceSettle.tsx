import React, { useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import { useCreateInvoice, useRecordPayment } from '../../hooks/useInvoices';
import { Booking, Payment } from '../../types';
import { Quotation } from '../../hooks/useQuotations';
import { Ready } from '../../lib/cateringTodo';
import { invoiceFromQuote } from '../../lib/invoiceEdit';
import { formatDateIST } from '../../lib/ist';
import { inr } from '../../lib/money';

export const SETTLED_NOTE = 'Settled outside the app';

// A past event paid outside the app: a paid invoice dated on the event day, so Money adds up.
export const useSettleOutside = () => {
  const create = useCreateInvoice();
  const record = useRecordPayment();
  const settle = async (b: Booking, q?: Quotation) => {
    const advance = b.advance_received ?? 0;
    const inv = await create.mutateAsync({
      ...invoiceFromQuote(b, q), status: 'draft', issue_date: b.event_date, advance_paid: advance,
      advance_mode: (b.advance_mode as Payment['payment_mode']) || 'cash', advance_date: b.advance_date ?? b.event_date,
    });
    const rest = Math.max(0, Number(inv.total_amount) - advance);
    if (rest > 0) await record.mutateAsync({ invoiceId: inv.id, amount: rest, payment_type: 'partial', payment_mode: 'cash', notes: SETTLED_NOTE, payment_date: b.event_date });
    return inv.id as string;
  };
  return { settle, busy: create.isPending || record.isPending };
};

interface Props { item: Ready; booking: Booking; quote?: Quotation; onInvoice: (bookingId: string) => void; onClose: () => void; onDone: (invoiceId: string) => void }

// "Invoice or settle" on a past event with no invoice.
const InvoiceSettle: React.FC<Props> = ({ item, booking, quote, onInvoice, onClose, onDone }) => {
  const { settle, busy } = useSettleOutside();
  const [choice, setChoice] = useState<'invoice' | 'settle'>('settle');
  const value = quote?.total_amount ?? booking.estimated_cost ?? 0;
  const day = formatDateIST(booking.event_date, 'd MMM yyyy');
  const go = async () => {
    if (choice === 'invoice') { onInvoice(booking.id); return; }
    try { const id = await settle(booking, quote); toast.success(`${booking.customer?.name ?? 'Event'} marked as settled outside`); onDone(id); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Could not save'); }
  };
  const cards: ['invoice' | 'settle', string, string][] = [
    ['settle', 'Paid outside the app', `Saves a paid invoice for ${inr(value)} dated ${day}, so Money adds up`],
    ['invoice', 'Create an invoice', `From ${item.quote?.quotation_number ?? 'the booking'} · you record payments as they come`],
  ];
  return (
    <Modal title={`${booking.customer?.name ?? 'Customer'} · ${booking.event_type}`} onClose={onClose} width={520} busy={busy}
      footer={<>
        <button type="button" className="ui-btn" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className="ui-btn primary" onClick={go} disabled={busy}>{busy ? 'Saving…' : choice === 'settle' ? 'Mark as settled' : 'Create invoice'}</button>
      </>}>
      <div className="mx-dlg">
        <p className="mx-dlg-sub">{day} · {inr(value)} quoted · no invoice yet</p>
        <div role="radiogroup" aria-label="What happened" className="mx-cards">
          {cards.map(([id, title, line]) => (
            <button key={id} type="button" role="radio" aria-checked={choice === id} className="mx-rcard" onClick={() => setChoice(id)}>
              <i aria-hidden="true" /><span><b>{title}</b><small>{line}</small></span><span />
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
};

export default InvoiceSettle;
