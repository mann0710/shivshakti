import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useBookings, useUpdateBooking, useDeleteBooking } from '../hooks/useBookings';
import { useTeamMembers } from '../hooks/useDataCenter';
import StatusPill from '../components/StatusPill';
import { Booking } from '../types';
import { formatDateIST } from '../lib/ist';
import { inr } from '../lib/money';
import { useBookingValue } from '../hooks/useBookingValue';
import { Navigate, useNavIntent } from '../hooks/useNavIntent';
import { useConfirm } from '../components/ui/ConfirmDialog';
import BookingFormModal from '../components/catering/BookingFormModal';
import EventDetail from '../components/catering/EventDetail';
import BookingCards, { dateRange } from '../components/catering/BookingCards';
import BookingActions, { BookingHandlers, StatusSelect, cap } from '../components/catering/BookingActions';
import { calendarUrl, promptCalendar, fmtTime } from '../components/catering/BookingCalendar';

type StatusFilter = 'all' | 'inquiry' | 'followup' | 'confirmed' | 'completed' | 'cancelled';
const FILTERS: StatusFilter[] = ['all', 'inquiry', 'followup', 'confirmed', 'completed', 'cancelled'];

// Legacy "pending" bookings count as inquiries.
const inFilter = (b: Booking, f: StatusFilter) =>
  f === 'all' || b.status === f || (f === 'inquiry' && b.status === 'pending');

const matchesSearch = (b: Booking, q: string) => {
  if (!q) return true;
  const text = [b.customer?.name, b.customer?.phone, b.venue, b.event_type].join(' ').toLowerCase();
  const digits = q.replace(/\D/g, '');
  return text.includes(q) || (digits.length >= 3 && (b.customer?.phone ?? '').replace(/\D/g, '').includes(digits));
};

interface Props { onNavigate?: Navigate }

const Bookings: React.FC<Props> = ({ onNavigate }) => {
  const { data: bookings = [], isLoading } = useBookings();
  const { data: teamMembers = [] } = useTeamMembers();
  const valueOf = useBookingValue();
  const updateBooking = useUpdateBooking();
  const deleteBooking = useDeleteBooking();
  const { confirm, dialog } = useConfirm();
  const intent = useNavIntent('bookings');

  const [filter, setFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  // 'new' = empty form, a Booking = edit form, null = closed
  const [formFor, setFormFor] = useState<Booking | 'new' | null>(intent?.action === 'new' ? 'new' : null);
  const [presetCustomerId, setPresetCustomerId] = useState(intent?.action === 'new' ? intent.id : undefined);

  // "open" intent shows that event's page.
  const [eventId, setEventId] = useState<string | null>(intent?.action === 'open' ? intent.id ?? null : null);

  const teamEmails = useMemo(() => teamMembers.map(t => t.email).filter(Boolean) as string[], [teamMembers]);
  const q = search.trim().toLowerCase();
  const searched = bookings.filter(b => matchesSearch(b, q));
  const filtered = searched.filter(b => inFilter(b, filter));

  const closeForm = () => { setFormFor(null); setPresetCustomerId(undefined); };

  const handleStatus = async (b: Booking, status: Booking['status']) => {
    try {
      const saved: Booking = await updateBooking.mutateAsync({ id: b.id, status });
      if (status === 'confirmed' && b.status !== 'confirmed') promptCalendar(saved ?? { ...b, status }, teamEmails);
      else toast.success('Status updated');
    } catch (e: any) { toast.error(e?.message || 'Failed to update status'); }
  };

  const handleDelete = async (b: Booking) => {
    const ok = await confirm({
      title: 'Delete booking?',
      message: <><b>{b.event_type}</b> for <b>{b.customer?.name ?? 'this customer'}</b> on {dateRange(b)} will be removed. This cannot be undone.</>,
      confirmLabel: 'Delete', danger: true,
    });
    if (!ok) return;
    try {
      await deleteBooking.mutateAsync(b.id);
      toast.success('Booking deleted');
    } catch (e: any) { toast.error(e?.message || 'Failed to delete'); }
  };

  const handlers: BookingHandlers = {
    onStatus: handleStatus,
    onEdit: b => setFormFor(b),
    onOpen: b => setEventId(b.id),
    onDelete: handleDelete,
    onQuote: onNavigate ? b => onNavigate('quotations', { action: 'new', id: b.id }) : undefined,
    onInvoice: onNavigate ? b => onNavigate('billing', { action: 'new', id: b.id }) : undefined,
    calendarHref: b => calendarUrl(b, teamEmails),
  };

  return (
    <div>
      <div className="page-topbar">
        <div style={{ fontSize: 16, fontWeight: 600 }}>Bookings</div>
        <button style={btnPrimary} onClick={() => setFormFor('new')}>+ New Booking</button>
      </div>
      <div className="page-content">
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="search" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search bookings"
            placeholder="🔍 Search name, phone, venue, event" style={searchInp} />
          {FILTERS.map(s => (
            <button key={s} onClick={() => setFilter(s)}
              style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: '0.5px solid',
                background: filter === s ? '#E8750A' : 'transparent',
                color: filter === s ? '#fff' : '#666660',
                borderColor: filter === s ? '#E8750A' : '#D0D0CC' }}>
              {cap(s)} ({searched.filter(b => inFilter(b, s)).length})
            </button>
          ))}
        </div>

        {isLoading ? (
          <div style={emptyBox}>Loading bookings...</div>
        ) : filtered.length === 0 ? (
          <div style={emptyBox}>
            No bookings found
            {q && <div><button style={{ ...btnGhost, marginTop: 10 }} onClick={() => setSearch('')}>Clear search</button></div>}
          </div>
        ) : (
          <>
            <div className="only-desktop">
              <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#FAFAF8', borderBottom: '0.5px solid #E5E5E0' }}>
                      {['Customer', 'Event', 'Date', 'Venue', 'Guests', 'Amount', 'Status', 'Actions'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 500, color: '#888880', fontSize: 12 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(b => (
                      <tr key={b.id} style={{ borderBottom: '0.5px solid #F0F0EC' }}>
                        <td style={td}>
                          <button type="button" onClick={() => setEventId(b.id)} title="Open event" style={nameBtn}>{b.customer?.name}</button>
                          <div style={{ fontSize: 11, color: '#888880' }}>{b.customer?.phone}</div>
                        </td>
                        <td style={td}>{b.event_type}</td>
                        <td style={{ ...td, color: '#666660', whiteSpace: 'nowrap' }}>
                          {formatDateIST(b.event_date, 'dd-MM-yyyy')}
                          {b.end_date && b.end_date !== b.event_date && (
                            <div style={{ fontSize: 11, color: '#E8750A', marginTop: 1 }}>to {formatDateIST(b.end_date, 'dd-MM-yyyy')}</div>
                          )}
                          {b.event_time && <div style={{ fontSize: 11, marginTop: 1 }}>{fmtTime(b.event_time)}</div>}
                        </td>
                        <td style={{ ...td, color: '#666660', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={b.venue}>{b.venue || '—'}</td>
                        <td style={td}>{b.guest_count}</td>
                        <td style={{ ...td, fontWeight: 500, whiteSpace: 'nowrap' }}>{inr(valueOf(b))}</td>
                        <td style={td}><StatusPill status={b.status} /></td>
                        <td style={{ ...td, whiteSpace: 'nowrap' }}>
                          <StatusSelect value={b.status} onChange={s => handleStatus(b, s)} style={{ marginRight: 6 }} />
                          <BookingActions booking={b} handlers={handlers} compact />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="only-mobile">
              <BookingCards bookings={filtered} handlers={handlers} />
            </div>
          </>
        )}
      </div>

      {eventId && onNavigate && (
        <EventDetail bookingId={eventId} onClose={() => setEventId(null)} onNavigate={onNavigate} onEdit={b => setFormFor(b)} />
      )}
      {formFor && (
        <BookingFormModal
          booking={formFor === 'new' ? null : formFor}
          presetCustomerId={presetCustomerId}
          onClose={closeForm}
          onSaved={(saved, confirmedNow) => {
            closeForm();
            if (confirmedNow) promptCalendar(saved, teamEmails);
          }}
        />
      )}
      {dialog}
    </div>
  );
};

const card: React.CSSProperties = { background: '#FFFFFF', border: '0.5px solid #E5E5E0', borderRadius: 12, padding: 16 };
const emptyBox: React.CSSProperties = { ...card, padding: 40, textAlign: 'center', color: '#888880', fontSize: 13 };
const td: React.CSSProperties = { padding: '10px 12px' };
const nameBtn: React.CSSProperties = { background: 'none', border: 'none', padding: 0, fontWeight: 600, fontSize: 13, color: '#185FA5', cursor: 'pointer', textAlign: 'left' };
const btnPrimary: React.CSSProperties = { background: '#E8750A', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 };
const btnGhost: React.CSSProperties = { background: 'transparent', border: '0.5px solid #D0D0CC', padding: '6px 12px', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#666660' };
const searchInp: React.CSSProperties = { flex: '1 1 220px', maxWidth: 320, padding: '7px 12px', borderRadius: 20, border: '0.5px solid #D0D0CC', fontSize: 13, background: '#FFFFFF', color: '#1A1A18', boxSizing: 'border-box' };

export default Bookings;
