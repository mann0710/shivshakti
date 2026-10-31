import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuoteForm } from '../hooks/useQuoteForm';
import { useAcceptFlow, useQuotePdfPref } from '../hooks/useAcceptFlow';
import { useHasQuoteOptions } from '../hooks/useSchemaStatus';
import { useInvoices } from '../hooks/useInvoices';
import { Quotation } from '../hooks/useQuotations';
import { Navigate, useNavIntent } from '../hooks/useNavIntent';
import { Booking } from '../types';
import BookingFormModal from '../components/catering/BookingFormModal';
import QuoteBoard from '../components/quotes/QuoteBoard';
import QuoteEditor from '../components/quotes/QuoteEditor';
import NewQuoteDialog from '../components/quotes/NewQuoteDialog';
import { useQuoteActions } from '../components/quotes/useQuoteActions';
import '../styles/quotes.css';

interface Props { onNavigate?: Navigate }

// Quotations: the follow-up list, or the editor for one quote.
const Quotations: React.FC<Props> = ({ onNavigate }) => {
  const f = useQuoteForm();
  const flow = useAcceptFlow(onNavigate);
  const hasOptions = useHasQuoteOptions();
  const { data: invoices = [] } = useInvoices();
  const invoiced = useMemo(() => new Set(invoices.map(i => i.booking_id)), [invoices]);
  const [pdf, setPdf] = useQuotePdfPref();
  const [session, setSession] = useState(0);
  const [newOpen, setNewOpen] = useState(false);
  const [newEvent, setNewEvent] = useState(false);
  const [startFor, setStartFor] = useState<string | null>(null);
  const intent = useNavIntent('quotations');
  const handled = useRef(false);

  const openEdit = (q: Quotation) => { setSession(s => s + 1); f.openEdit(q); };
  const openCreate = (b: Booking) => { setSession(s => s + 1); f.openCreate(b); };
  const { actions, dialog } = useQuoteActions({ f, flow, pdfPrices: pdf.prices, openEdit, onNavigate });

  // A new editor starts at the top of the page.
  useEffect(() => { if (session) document.querySelector('.app-main')?.scrollTo?.({ top: 0 }); }, [session]);

  // A booking made from "A new event" opens once the list has it, so nothing changes under the editor.
  useEffect(() => {
    const b = startFor ? f.bookings.find(x => x.id === startFor) : undefined;
    if (b) { setStartFor(null); openCreate(b); }
  }, [startFor, f.bookings]); // eslint-disable-line

  // Nav intent: 'open' edits a quote (by its id or booking id); 'new' always starts one, for the booking when given.
  useEffect(() => {
    if (!intent || handled.current || !f.quotationsFetched) return;
    const id = intent.id;
    const qs = f.quotations;
    const q = intent.action === 'open' && id ? qs.find(x => x.id === id) ?? qs.find(x => x.booking_id === id) : undefined;
    const b = id ? f.bookings.find(x => x.id === id) : undefined;
    if (!q && id && !b && !f.bookingsFetched) return;
    handled.current = true;
    if (q) openEdit(q);
    else if (b) openCreate(b);
    else setNewOpen(true);
  }, [intent, f.quotationsFetched, f.bookingsFetched, f.quotations, f.bookings]); // eslint-disable-line

  return (
    <>
      {f.showForm ? (
        <QuoteEditor f={f} session={session} hasOptions={hasOptions} pdfPrices={pdf.prices} onPdfPrices={prices => setPdf({ prices })}
          onSend={(q, options) => flow.share(q, pdf.prices, options, false)} onAddOption={actions.addOption} onSwitch={openEdit}
          onClose={() => f.resetForm()} onOpenBooking={onNavigate ? id => onNavigate('bookings', { action: 'open', id }) : undefined} />
      ) : (
        <QuoteBoard quotes={f.quotations} loading={f.isLoading} invoiced={invoiced} a={actions} onNew={() => setNewOpen(true)} />
      )}
      {newOpen && (
        <NewQuoteDialog bookings={f.bookings} quotes={f.quotations} onClose={() => setNewOpen(false)}
          onStart={b => { setNewOpen(false); openCreate(b); }} onOpen={q => { setNewOpen(false); openEdit(q); }}
          onNewEvent={() => { setNewOpen(false); setNewEvent(true); }} />
      )}
      {newEvent && <BookingFormModal booking={null} onClose={() => setNewEvent(false)} onSaved={b => { setNewEvent(false); setStartFor(b.id); }} />}
      {flow.ui}
      {dialog}
    </>
  );
};

export default Quotations;
