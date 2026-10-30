import React, { useState } from 'react';
import Modal from '../ui/Modal';
import StatusPill from '../StatusPill';
import EventStepper from './EventStepper';
import PaymentFormModal from './PaymentFormModal';
import { dateRange } from './BookingCards';
import { useBookings } from '../../hooks/useBookings';
import { useQuotations } from '../../hooks/useQuotations';
import { useInvoices } from '../../hooks/useInvoices';
import { useAcceptFlow } from '../../hooks/useAcceptFlow';
import { optionTitle, siblingsOf, statusText, totalText } from '../../lib/quoteOptions';
import { Navigate } from '../../hooks/useNavIntent';
import { eventStage } from '../../lib/eventStage';
import { pendingChoice, openChoiceLabels } from '../../lib/quoteChoices';
import { waNumber } from '../../lib/quoteMath';
import { inr } from '../../lib/money';
import { Booking } from '../../types';
import { ORANGE, btnGhost, btnPrimary } from './CustomerUi';

interface Props { bookingId: string; onClose: () => void; onNavigate: Navigate; onEdit: (b: Booking) => void }

// One place per event: progress, quotes, invoice and payments, with the next step one tap away.
const EventDetail: React.FC<Props> = ({ bookingId, onClose, onNavigate, onEdit }) => {
  const { data: bookings = [] } = useBookings();
  const { data: allQuotes = [] } = useQuotations();
  const { data: invoices = [] } = useInvoices();
  const lifecycle = useAcceptFlow(onNavigate);
  const [paying, setPaying] = useState(false);

  const b = bookings.find(x => x.id === bookingId);
  if (!b) return null;
  const quotes = allQuotes.filter(q => q.booking_id === b.id).sort((x, y) => y.created_at.localeCompare(x.created_at));
  const invoice = invoices.find(i => i.booking_id === b.id);
  const stage = eventStage(b, quotes, invoice);
  const go: Navigate = (page, intent) => { onClose(); onNavigate(page, intent); };
  const phone = b.customer?.phone?.trim();
  // A quote whose option or dishes are still open comes before the invoice.
  const pickOf = (q: typeof quotes[number]) => pendingChoice(q, siblingsOf(q, allQuotes).length);
  const toPick = !invoice && (stage === 'quoted' || stage === 'confirmed') ? quotes.find(q => pickOf(q)) : undefined;
  const pickLabel = (q: typeof quotes[number]) => (pickOf(q) === 'option' ? 'Pick option & accept' : pickOf(q) === 'dishes' ? 'Pick dishes & accept' : 'Accept');
  const next = toPick && (pickOf(toPick) === 'option'
    ? 'Ask which option the customer wants, then accept it'
    : `Ask which ${openChoiceLabels(toPick).join(', ')} the customer wants, then accept the quote`);

  const primary = (() => {
    if (toPick) return <button type="button" style={btnPrimary} onClick={() => lifecycle.accept(toPick)}>{pickLabel(toPick)}</button>;
    switch (stage) {
      case 'inquiry': return <button type="button" style={btnPrimary} onClick={() => go('quotations', { action: 'new', id: b.id })}>Make quotation</button>;
      case 'confirmed': return <button type="button" style={btnPrimary} onClick={() => go('billing', { action: 'new', id: b.id })}>Create invoice</button>;
      case 'invoiced': return <button type="button" style={btnPrimary} onClick={() => setPaying(true)}>Record payment</button>;
      default: return null;
    }
  })();

  return (
    <Modal title={`${b.customer?.name ?? 'Event'} · ${b.event_type}`} onClose={onClose} width={620}
      footer={<>
        <button type="button" style={btnGhost} onClick={() => { onClose(); onEdit(b); }}>Edit details</button>
        {primary}
      </>}>
      <div style={{ fontSize: 12, color: '#666660', marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span>{[dateRange(b), b.venue, `${b.guest_count || 0} guests`].filter(Boolean).join(' · ')}</span>
        {phone && <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} style={link}>📞 Call</a>}
        {phone && <a href={`https://wa.me/${waNumber(phone)}`} target="_blank" rel="noopener noreferrer" style={{ ...link, color: '#128C7E' }}>💬 WhatsApp</a>}
      </div>

      <EventStepper stage={stage} next={next} />

      <Section title="Quotations" action={<button type="button" style={small} onClick={() => go('quotations', { action: 'new', id: b.id })}>+ New</button>}>
        {quotes.length === 0 ? <Empty>No quotation yet</Empty> : quotes.map(q => (
          <div key={q.id} style={row}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{q.quotation_number}{q.option_label ? ` · ${optionTitle(q)}` : ''} · {totalText(q)}</div>
              <div style={{ fontSize: 11, color: '#888880' }}>{q.per_plate_amount > 0 ? `${inr(q.per_plate_amount)}/plate` : q.is_multi_day ? 'Multi-day' : ''}</div>
            </div>
            <StatusPill status={q.status} label={statusText(q)} />
            <button type="button" style={small} onClick={() => go('quotations', { action: 'open', id: q.id })}>Edit</button>
            <button type="button" style={small} onClick={() => lifecycle.share(q, true, siblingsOf(q, allQuotes))}>Share</button>
            {q.status !== 'accepted' && stage !== 'cancelled' && (
              <button type="button" style={{ ...small, background: ORANGE, color: '#fff', borderColor: ORANGE }} onClick={() => lifecycle.accept(q)}>{pickLabel(q)}</button>
            )}
          </div>
        ))}
      </Section>

      <Section title="Invoice & payments">
        {!invoice ? <Empty>{stage === 'confirmed' ? 'Ready to invoice' : 'Invoice comes after the quote is accepted'}</Empty> : (
          <div style={row}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{invoice.invoice_number} · {inr(invoice.total_amount)}</div>
              <div style={{ fontSize: 11, color: '#888880' }}>Paid {inr(invoice.advance_paid)} · Balance {inr(invoice.balance_due)}</div>
            </div>
            <StatusPill status={invoice.status} />
            <button type="button" style={small} onClick={() => go('billing', { action: 'open', id: invoice.id })}>Open</button>
          </div>
        )}
      </Section>

      {paying && invoice && invoice.balance_due > 0 && <PaymentFormModal invoice={invoice} onClose={() => setPaying(false)} />}
      {lifecycle.ui}
    </Modal>
  );
};

const Section: React.FC<{ title: string; action?: React.ReactNode; children: React.ReactNode }> = ({ title, action, children }) => (
  <div style={{ border: '0.5px solid #E5E5E0', borderRadius: 8, marginBottom: 12, overflow: 'hidden' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 12px', background: '#F9F8F5', fontSize: 11, fontWeight: 600, color: '#888880' }}>
      <span>{title.toUpperCase()}</span>{action}
    </div>
    {children}
  </div>
);
const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => <div style={{ padding: '10px 12px', fontSize: 12, color: '#AAAAAA' }}>{children}</div>;

const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderTop: '0.5px solid #F0F0EC', fontSize: 13, flexWrap: 'wrap' };
const small: React.CSSProperties = { fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '0.5px solid #D0D0CC', background: '#fff', color: '#444', cursor: 'pointer' };
const link: React.CSSProperties = { fontSize: 12, textDecoration: 'none', color: '#185FA5' };

export default EventDetail;
