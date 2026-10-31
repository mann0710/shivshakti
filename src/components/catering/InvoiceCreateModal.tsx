import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import { useBookings, useUpdateBooking } from '../../hooks/useBookings';
import { useQuotations } from '../../hooks/useQuotations';
import { useCreateInvoice, useInvoices } from '../../hooks/useInvoices';
import { Payment } from '../../types';
import { formatDateIST, todayIST } from '../../lib/ist';
import { inr } from '../../lib/money';
import { pickQuotation } from '../../lib/quoteMath';
import { invoiceTodo } from '../../lib/cateringTodo';
import { awaitsAcceptance } from '../../lib/moneyView';
import { amountOf, invoiceFromQuote, needsGuests, quoteValue } from '../../lib/invoiceEdit';
import { Empty } from '../money/MoneyUi';
import { grouped } from './PaymentFields';

interface Props { bookingId?: string; onClose: () => void; onCreated: (invoiceId: string) => void }

// DlgMoney "New invoice": pick a confirmed event, confirm final guests and any advance.
const InvoiceCreateModal: React.FC<Props> = ({ bookingId, onClose, onCreated }) => {
  const { data: bookings = [] } = useBookings();
  const { data: quotations = [] } = useQuotations();
  const { data: invoices = [] } = useInvoices();
  const createInvoice = useCreateInvoice();
  const updateBooking = useUpdateBooking();
  const today = todayIST();

  const choices = useMemo(() => {
    const t = invoiceTodo(bookings, quotations, invoices, today);
    const ids = t.ready.map(r => r.booking.id).filter(id => !awaitsAcceptance(id, quotations));
    return [...ids, ...(bookingId && !ids.includes(bookingId) ? [bookingId] : [])].map(id => bookings.find(b => b.id === id)!).filter(Boolean);
  }, [bookings, quotations, invoices, today, bookingId]);
  const waiting = useMemo(() => {
    const sent = quotations.find(q => q.status === 'sent' && bookings.some(b => b.id === q.booking_id && b.event_date >= today && b.status !== 'cancelled'));
    return sent && bookings.find(b => b.id === sent.booking_id);
  }, [quotations, bookings, today]);

  const [pickedId, setPickedId] = useState(bookingId ?? '');
  const booking = choices.find(b => b.id === (pickedId || choices[0]?.id));
  const quote = booking ? pickQuotation(quotations, booking.id) : undefined;
  const [guests, setGuests] = useState<Record<string, string>>({});
  const [advance, setAdvance] = useState<Record<string, string>>({});
  const [tried, setTried] = useState(false);
  const guestText = booking ? guests[booking.id] ?? (booking.guest_count > 0 ? String(booking.guest_count) : '') : '';
  const advanceText = booking ? advance[booking.id] ?? String(booking.advance_received ?? 0) : '0';
  const guestError = booking && needsGuests(quote, booking) && !(Number(guestText) > 0) ? 'Needed — the quote has no guest count' : '';
  const busy = createInvoice.isPending || updateBooking.isPending;

  const create = async () => {
    setTried(true);
    if (!booking || guestError) return;
    const finalGuests = Number(guestText) || 0;
    try {
      if (finalGuests > 0 && finalGuests !== booking.guest_count) await updateBooking.mutateAsync({ id: booking.id, guest_count: finalGuests });
      const inv = await createInvoice.mutateAsync({
        ...invoiceFromQuote(booking, quote, finalGuests),
        advance_paid: amountOf(advanceText), status: 'draft', issue_date: today,
        advance_mode: (booking.advance_mode as Payment['payment_mode']) || 'cash', advance_date: booking.advance_date ?? null,
      });
      toast.success(`${inv.invoice_number ?? 'Invoice'} created for ${booking.customer?.name ?? 'the event'}`);
      onCreated(inv.id);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not create the invoice'); }
  };

  return (
    <Modal title="New invoice" onClose={onClose} width={560} busy={busy}
      footer={<>
        <button type="button" className="ui-btn" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className="ui-btn primary" onClick={create} disabled={busy || !booking}>{busy ? 'Creating…' : 'Create invoice'}</button>
      </>}>
      <div className="mx-dlg">
        <p className="mx-dlg-sub">Pick a confirmed event. Prices and dishes come from its accepted quote.</p>
        {choices.length === 0 ? (
          <div className="mx-card"><Empty title="No confirmed events to invoice" text="Accept a quote or confirm a booking first." /></div>
        ) : (
          <div className="mx-field">
            <span className="mx-heading">Confirmed, not invoiced yet · {choices.length}</span>
            <div role="radiogroup" aria-label="Event to invoice" className="mx-cards">
              {choices.map(b => {
                const q = pickQuotation(quotations, b.id);
                const on = b.id === booking?.id;
                return (
                  <button key={b.id} type="button" role="radio" aria-checked={on} className="mx-rcard" onClick={() => setPickedId(b.id)}>
                    <i aria-hidden="true" />
                    <span><b>{b.customer?.name ?? 'Customer'} · {b.event_type}</b>
                      <small>{[formatDateIST(b.event_date, 'EEE d MMM'), q?.quotation_number, needsGuests(q, b) ? 'guest count missing' : ''].filter(Boolean).join(' · ')}</small></span>
                    <b>{inr(quoteValue(q, b))}</b>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {waiting && <p className="mx-hint">{waiting.customer?.name}'s {waiting.event_type} shows up here once the quote is accepted.</p>}
        {booking && (
          <div className="mx-grid2">
            <label className={`mx-field${tried && guestError ? ' bad' : ''}`}>Final guests
              <input inputMode="numeric" value={guestText} placeholder="How many came or will come" aria-invalid={!!(tried && guestError)}
                onChange={e => setGuests(g => ({ ...g, [booking.id]: e.target.value.replace(/\D/g, '') }))} />
              {tried && guestError ? <span className="mx-err">{guestError}</span> : <span className="mx-hint">{quote?.per_plate_amount ? `${inr(quote.per_plate_amount)} a plate` : 'For the invoice'}</span>}
            </label>
            <label className="mx-field">Advance already received
              <input inputMode="decimal" value={`₹${grouped(advanceText)}`} onChange={e => setAdvance(a => ({ ...a, [booking.id]: e.target.value.replace(/[^\d.]/g, '') }))} />
              <span className="mx-hint">{(booking.advance_received ?? 0) > 0 ? 'From recorded payments' : 'Leave ₹0 if none'}</span>
            </label>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default InvoiceCreateModal;
