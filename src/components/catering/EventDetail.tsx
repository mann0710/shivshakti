import React, { useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import EventStepper from './EventStepper';
import BookingMenu, { BoardActions } from './BookingMenu';
import { fmtTime } from './BookingCalendar';
import PaymentDialog from './PaymentDialog';
import { Payment } from '../../types';
import { EventInvoice, EventPayments, EventQuotes, MoneySummary, PayLine } from '../bookings/EventSections';
import { invoiceText, modeText, moneyRows, nextBanner, remindHref, stageRows } from '../bookings/eventFacts';
import { splitFood } from '../bookings/bookingForm';
import { BookingView } from '../../lib/bookingBoard';
import { useQuotations } from '../../hooks/useQuotations';
import { usePaymentHistory } from '../../hooks/useInvoices';
import { useDocSettings } from '../../hooks/useDocSettings';
import { Navigate } from '../../hooks/useNavIntent';
import { siblingsOf } from '../../lib/quoteOptions';
import { formatDateIST, todayIST } from '../../lib/ist';
import { invoiceDoc } from '../../lib/docs/invoiceDoc';
import { shareDoc } from '../../lib/docs/output';

interface Props { view: BookingView; actions: BoardActions; onClose: () => void; onNavigate: Navigate }

// One side panel per event: stage, next step, quotes, invoice, payments and money; nested dialogs open on top.
const EventDetail: React.FC<Props> = ({ view: v, actions: a, onClose, onNavigate }) => {
  const { data: allQuotes = [] } = useQuotations();
  const { data: payments = [] } = usePaymentHistory(v.invoice?.id);
  const pct = useDocSettings().schedule[0]?.pct ?? 0;
  const [editing, setEditing] = useState<Payment | 'new' | null>(null);

  const b = v.b;
  const inv = v.invoice;
  const live = v.stage !== 'cancelled' && b.status !== 'completed';
  const quotes = allQuotes.filter(q => q.booking_id === b.id).sort((x, y) => y.created_at.localeCompare(x.created_at));
  const banner = nextBanner(v, todayIST(), v.quote ? siblingsOf(v.quote, allQuotes).length : 1);
  const money = moneyRows(v, pct);
  const noted = b.food_type || splitFood(b.special_instructions).food;
  const food = v.quote?.food_type || (noted !== 'Regular' ? noted : '');
  const when = `${formatDateIST(v.start, 'EEE d MMM')}${v.end > v.start ? ` – ${formatDateIST(v.end, 'EEE d MMM')}` : ''}`;
  const sub = [when, fmtTime(b.event_time), b.guest_count > 0 ? `${b.guest_count} guests` : 'Guests not set', food, b.venue].filter(Boolean).join(' · ');
  const go: Navigate = (page, intent) => { onClose(); onNavigate(page, intent); };
  // Every payment on the booking, before and after the invoice; each can be changed.
  const lines: PayLine[] = v.payments.map(p => ({
    key: p.id, title: `${formatDateIST(p.payment_date, 'EEE d MMM')} · ${p.payment_type === 'refund' ? 'given back' : p.payment_type === 'advance' ? 'advance' : 'payment'}`,
    sub: [modeText(p.payment_mode), p.notes].filter(Boolean).join(' · '), amount: Number(p.amount), onEdit: () => setEditing(p),
  }));

  const sendInvoice = async () => {
    try { await shareDoc(() => invoiceDoc(inv!, allQuotes.find(q => q.id === inv!.quotation_id) ?? v.quote, payments), invoiceText(v), b.customer?.phone); }
    catch (e: any) { toast.error(e?.message || 'Could not share the invoice'); }
  };

  const remind = remindHref(v);
  const secondary = remind ? <a className="ui-btn" href={remind} target="_blank" rel="noopener noreferrer">Remind</a>
    : live && v.next?.kind !== 'advance' && v.next?.kind !== 'payment' ? <button type="button" className="ui-btn" onClick={() => setEditing('new')}>Record payment</button>
    : v.stage !== 'cancelled' ? <button type="button" className="ui-btn" onClick={() => a.edit(b)}>Edit details</button> : null;
  const footer = (
    <div className="ev-foot">
      <BookingMenu view={v} actions={a} onPage />
      <span className="grow" />
      {secondary}
      {v.next && <button type="button" className="ui-btn primary" onClick={() => a.run(v)}>{v.next.label}</button>}
    </div>
  );

  return (
    <Modal title={`${b.customer?.name ?? 'Event'} · ${b.event_type}`} onClose={onClose} variant="panel" footer={footer}>
      <div className="ev">
        <p className="ev-sub">{sub}</p>
        {banner && <div className={`ev-banner ${banner.tone}`} role="status">{banner.text}</div>}
        {!inv && v.stage !== 'cancelled' && <EventStepper rows={stageRows(v, quotes)} />}
        <EventQuotes quotes={quotes} live={live} onNew={() => a.quote(b)} onAccept={a.accept} canAccept={q => v.stage !== 'cancelled' && q.status !== 'accepted'}
          onEdit={q => go('quotations', { action: 'open', id: q.id })} onSend={a.send} />
        {inv && <EventInvoice invoice={inv} onOpen={() => go('billing', { action: 'open', id: inv.id })} onSend={sendInvoice} onPay={() => a.pay(v)} />}
        {!inv && money.length > 0 && <MoneySummary rows={money} />}
        {lines.length > 0 && <EventPayments lines={lines} />}
      </div>
      {editing && <PaymentDialog booking={b} invoice={inv} quote={v.quote} payment={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </Modal>
  );
};

export default EventDetail;
