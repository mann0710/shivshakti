import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useBookings, useUpdateBooking, useDeleteBooking } from '../hooks/useBookings';
import { useTeamMembers } from '../hooks/useDataCenter';
import { useQuotations } from '../hooks/useQuotations';
import { useInvoices } from '../hooks/useInvoices';
import { useBookingValue } from '../hooks/useBookingValue';
import { useAcceptFlow } from '../hooks/useAcceptFlow';
import { useStoredState } from '../hooks/useStoredState';
import { useSeasonalOccasions } from '../hooks/useSeasonalOccasions';
import { Navigate, useNavIntent } from '../hooks/useNavIntent';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { Booking, Invoice } from '../types';
import { formatDateIST, todayIST } from '../lib/ist';
import { inr } from '../lib/money';
import { downloadDoc } from '../lib/docs/output';
import { siblingsOf } from '../lib/quoteOptions';
import { eventMenuDoc } from '../lib/docs/invoiceDoc';
import { bookingView, BookingView, boardStats, groupByMonth, sortForTab, dateRangeText, festivalDays, neverInvoiced, Tab, TABS } from '../lib/bookingBoard';
import BookingFormModal from '../components/catering/BookingFormModal';
import EventDetail from '../components/catering/EventDetail';
import PaymentFormModal from '../components/catering/PaymentFormModal';
import BookingAgenda from '../components/catering/BookingAgenda';
import BookingMonth from '../components/catering/BookingMonth';
import BookingPipeline from '../components/catering/BookingPipeline';
import { BoardActions } from '../components/catering/BookingMenu';
import { calendarUrl, promptCalendar } from '../components/catering/BookingCalendar';
import '../styles/bookings-dialogs.css';

type View = 'list' | 'calendar' | 'pipeline';
const VIEWS: { id: View; label: string }[] = [{ id: 'list', label: 'List' }, { id: 'calendar', label: 'Calendar' }, { id: 'pipeline', label: 'Pipeline' }];

const matchesSearch = (b: Booking, q: string) => {
  if (!q) return true;
  const text = [b.customer?.name, b.customer?.phone, b.venue, b.event_type].join(' ').toLowerCase();
  const digits = q.replace(/\D/g, '');
  return text.includes(q) || (digits.length >= 3 && (b.customer?.phone ?? '').replace(/\D/g, '').includes(digits));
};

interface Props { onNavigate?: Navigate; startView?: View }

// Bookings: one list, calendar or pipeline of events, each with a single next step and a ⋯ menu.
const Bookings: React.FC<Props> = ({ onNavigate, startView }) => {
  const { data: bookings = [], isLoading } = useBookings();
  const { data: quotes = [] } = useQuotations();
  const { data: invoices = [] } = useInvoices();
  const { data: teamMembers = [] } = useTeamMembers();
  const { data: occasions = [] } = useSeasonalOccasions();
  const valueOf = useBookingValue();
  const updateBooking = useUpdateBooking();
  const deleteBooking = useDeleteBooking();
  const accept = useAcceptFlow(onNavigate);
  const { confirm, dialog } = useConfirm();
  const intent = useNavIntent('bookings');
  const [pref, setPref] = useStoredState<{ view: View }>('shivshakti.bookingView', () => ({ view: 'list' }));
  // Arriving from "Calendar" opens that view once; the switch then remembers your choice.
  const [forced, setForced] = useState<View | undefined>(startView);
  const view = forced ?? pref.view;
  const [tab, setTab] = useState<Tab>('upcoming');
  const [search, setSearch] = useState('');
  // 'new' = empty form (optionally on a date), a Booking = edit form, null = closed
  const [formFor, setFormFor] = useState<Booking | 'new' | null>(intent?.action === 'new' ? 'new' : null);
  const [presetCustomerId, setPresetCustomerId] = useState(intent?.action === 'new' ? intent.id : undefined);
  const [presetDate, setPresetDate] = useState<string | undefined>();
  const [eventId, setEventId] = useState<string | null>(intent?.action === 'open' ? intent.id ?? null : null);
  const [paying, setPaying] = useState<Invoice | null>(null);
  const teamEmails = useMemo(() => teamMembers.map(t => t.email).filter(Boolean) as string[], [teamMembers]);

  const today = todayIST();
  const q = search.trim().toLowerCase();
  const views = useMemo(() => bookings.map(b => bookingView(b, { quotes, invoices, today, value: valueOf(b) })), [bookings, quotes, invoices, today, valueOf]);
  const shown = views.filter(v => matchesSearch(v.b, q));
  const inTab = (t: Tab) => shown.filter(v => v.tab === t);
  const groups = groupByMonth(sortForTab(inTab(tab), tab));
  const stats = boardStats(views);
  const attention = views.filter(v => v.tab === 'attention').length;
  const festivals = useMemo(() => festivalDays(occasions), [occasions]);
  const eventView = views.find(v => v.b.id === eventId);

  const setStatus = async (b: Booking, status: Booking['status']) => {
    try {
      const saved: Booking = await updateBooking.mutateAsync({ id: b.id, status });
      if (status === 'confirmed' && b.status !== 'confirmed') promptCalendar(saved ?? { ...b, status }, teamEmails);
      else toast.success('Status updated');
    } catch (e: any) { toast.error(e?.message || 'Failed to update status'); }
  };
  // Quotations are named and deleted with the booking; an invoice (money received) is never deleted from here.
  const remove = async (b: Booking) => {
    const what = <><b>{b.event_type}</b> for <b>{b.customer?.name ?? 'this customer'}</b> on {dateRangeText(b)}</>;
    const invoice = invoices.find(i => i.booking_id === b.id);
    if (invoice) {
      if (await confirm({ title: 'This booking has an invoice', message: <>{what} has invoice <b>{invoice.invoice_number}</b>, so it can't be deleted here and its payments stay safe. Mark it lost or cancelled instead?</>, confirmLabel: 'Mark cancelled' })) setStatus(b, 'cancelled');
      return;
    }
    const linked = quotes.filter(q => q.booking_id === b.id);
    const ok = await confirm({
      title: linked.length ? 'Delete booking and its quotations?' : 'Delete booking?',
      message: <>{what} will be removed.{linked.length > 0 && <> Its {linked.length === 1 ? 'quotation' : `${linked.length} quotations`} <b>{linked.map(q => q.quotation_number).join(', ')}</b> will be deleted too.</>} This cannot be undone.</>,
      confirmLabel: linked.length ? 'Delete all' : 'Delete', danger: true,
    });
    if (!ok) return;
    try {
      await deleteBooking.mutateAsync({ id: b.id, withQuotes: linked.length > 0 });
      toast.success(linked.length ? `Booking and ${linked.length === 1 ? 'its quotation' : `${linked.length} quotations`} deleted` : 'Booking deleted');
    } catch (e: any) { toast.error(e?.message || 'Failed to delete'); }
  };
  const go: Navigate = (page, i) => onNavigate?.(page, i);
  const closeAsLost = async (b: Booking) => {
    if (await confirm({ title: 'Close as lost or cancelled?', message: <><b>{b.customer?.name}</b> · {b.event_type} on {dateRangeText(b)} moves to Lost or cancelled. You can change it back from ⋯ → Change status.</>, confirmLabel: 'Close as lost' })) setStatus(b, 'cancelled');
  };

  // The one button on each booking.
  const run = async (v: BookingView) => {
    const b = v.b;
    switch (v.next?.kind) {
      case 'quote': return go('quotations', { action: 'new', id: b.id });
      case 'pick': case 'accept': return v.quote ? accept.accept(v.quote) : setEventId(b.id);
      case 'invoice': return go('billing', { action: 'new', id: b.id });
      case 'payment': return v.invoice && setPaying(v.invoice);
      case 'complete': return setStatus(b, 'completed');
      case 'close': return closeAsLost(b);
    }
  };
  const actions: BoardActions = {
    run,
    open: b => setEventId(b.id),
    edit: b => setFormFor(b),
    quote: b => go('quotations', { action: 'new', id: b.id }),
    invoice: b => go('billing', { action: 'new', id: b.id }),
    pay: v => v.invoice && setPaying(v.invoice),
    accept: q => accept.accept(q),
    send: q => accept.share(q, true, siblingsOf(q, quotes)),
    menuPdf: v => downloadDoc(() => eventMenuDoc(v.b, v.quote)),
    status: (b, s) => (s === 'cancelled' ? closeAsLost(b) : setStatus(b, s)),
    remove,
    calendarHref: b => calendarUrl(b, teamEmails),
    newOn: d => { setPresetDate(d); setFormFor('new'); },
  };
  const closeForm = () => { setFormFor(null); setPresetCustomerId(undefined); setPresetDate(undefined); };
  const switcher = (cls: string) => (
    <div role="group" aria-label="View" className={cls} style={{ background: '#fff', border: '1px solid #E0E0DA', borderRadius: 10, padding: 3, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
      {VIEWS.map(o => (
        <button key={o.id} type="button" aria-pressed={view === o.id} onClick={() => { setForced(undefined); setPref({ view: o.id }); }}
          style={{ border: 'none', borderRadius: 7, padding: '8px 14px', font: 'inherit', fontSize: 13, cursor: 'pointer', minHeight: 44,
            background: view === o.id ? '#1A1A18' : 'transparent', color: view === o.id ? '#fff' : '#4A4A45', fontWeight: view === o.id ? 600 : 400 }}>{o.label}</button>
      ))}
    </div>
  );

  return (
    <div>
      <div className="page-topbar" style={{ gap: 10 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Bookings</div>
          <div style={{ fontSize: 12.5, color: '#6B6B66' }}>{formatDateIST(today, 'EEEE, d MMM yyyy')}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {switcher('bk-switch-wide')}
          <button type="button" onClick={() => setFormFor('new')} style={btnPrimary}>+ New<span className="only-desktop-inline"> booking</span></button>
        </div>
      </div>

      <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {switcher('bk-switch-narrow')}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', borderBottom: view === 'list' ? '1px solid #E0E0DA' : 'none' }}>
          {view === 'list' ? (
            <div role="tablist" aria-label="Which bookings" className="bk-tabs">
              {TABS.map(t => {
                const n = inTab(t.id).length;
                return (
                  <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
                    className={`bk-tab${t.id === 'attention' && n > 0 ? ' warm' : ''}`}>
                    {t.label} <span className="n">{n}</span>
                  </button>
                );
              })}
            </div>
          ) : <span />}
          <input type="search" className="bk-search" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search bookings"
            placeholder="Search name, phone, venue, event" style={searchInp} />
        </div>

        {view === 'list' && tab === 'upcoming' && attention > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', background: '#FFF6EA', border: '1px solid #F3D3AD', borderRadius: 12, padding: '12px 16px' }}>
            <span style={{ fontSize: 14, color: '#6B3A00', flex: '1 1 260px' }}>
              <b>{attention} past event{attention > 1 ? 's are' : ' is'} still open.</b> Mark each one completed or cancelled so your totals stay right.
            </span>
            <button type="button" onClick={() => setTab('attention')} style={{ border: '1px solid #E8A867', background: '#fff', color: '#8A4B00', font: 'inherit', fontSize: 13, fontWeight: 600, padding: '8px 14px', borderRadius: 8, cursor: 'pointer', minHeight: 44 }}>Review {attention}</button>
          </div>
        )}

        {view === 'list' && tab === 'upcoming' && (
          <div className="bk-stats only-desktop">
            <Stat label="Upcoming" value={`${stats.upcoming} event${stats.upcoming === 1 ? '' : 's'}`}
              note={stats.nextUp ? `Next: ${stats.nextUp.b.customer?.name ?? '—'}, ${formatDateIST(stats.nextUp.start, 'd MMM')}` : 'Nothing booked yet'} />
            <Stat label="Confirmed value" value={inr(stats.confirmedValue)} note={`${stats.confirmedCount} confirmed event${stats.confirmedCount === 1 ? '' : 's'}`} />
            <Stat label="Waiting on you" value={`${stats.waiting} next step${stats.waiting === 1 ? '' : 's'}`} note={stats.waitingNote || 'All clear'} />
          </div>
        )}

        {isLoading ? <div style={emptyBox}>Loading bookings…</div>
          : view === 'calendar' ? <BookingMonth views={shown} actions={actions} today={today} festivals={festivals} />
          : view === 'pipeline' ? <BookingPipeline views={shown} actions={actions} today={today} unbilled={neverInvoiced(views).length} onInvoices={() => go('billing')} />
          : <BookingAgenda groups={groups} actions={actions}
              empty={q ? 'No bookings match your search' : tab === 'attention' ? 'Nothing needs attention' : `No ${TABS.find(t => t.id === tab)!.label.toLowerCase()} bookings`} />}
      </div>

      {eventView && onNavigate && <EventDetail view={eventView} actions={actions} onClose={() => setEventId(null)} onNavigate={onNavigate} />}
      {formFor && (
        <BookingFormModal booking={formFor === 'new' ? null : formFor} presetCustomerId={presetCustomerId} presetDate={presetDate}
          onClose={closeForm} onSaved={closeForm} />
      )}
      {paying && <PaymentFormModal invoice={paying} onClose={() => setPaying(null)} />}
      {accept.ui}
      {dialog}
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string; note: string }> = ({ label, value, note }) => (
  <div style={{ background: '#fff', border: '1px solid #E5E5E0', borderRadius: 12, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 3 }}>
    <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.4, color: '#6B6B66', textTransform: 'uppercase' }}>{label}</span>
    <span style={{ fontSize: 20, fontWeight: 700 }}>{value}</span>
    <span style={{ fontSize: 12.5, color: '#6B6B66' }}>{note}</span>
  </div>
);

const emptyBox: React.CSSProperties = { background: '#fff', border: '1px solid #E5E5E0', borderRadius: 14, padding: 40, textAlign: 'center', color: '#6B6B66', fontSize: 14 };
const btnPrimary: React.CSSProperties = { background: 'var(--primary)', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 10, fontSize: 14, cursor: 'pointer', fontWeight: 600, minHeight: 44 };
const searchInp: React.CSSProperties = { flex: '0 1 300px', minWidth: 200, minHeight: 44, padding: '9px 12px', borderRadius: 10, border: '1px solid #E0E0DA', fontSize: 13, background: '#fff', color: '#1A1A18', boxSizing: 'border-box', marginBottom: 6 };

export default Bookings;
