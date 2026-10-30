import React from 'react';
import { Booking } from '../../types';
import StatusPill from '../StatusPill';
import { formatDateIST } from '../../lib/ist';
import { inr } from '../../lib/money';
import { useBookingValue } from '../../hooks/useBookingValue';
import BookingActions, { BookingHandlers, StatusSelect } from './BookingActions';
import { fmtTime } from './BookingCalendar';

export const dateRange = (b: Booking) => {
  const from = formatDateIST(b.event_date, 'dd-MM-yyyy');
  return b.end_date && b.end_date !== b.event_date ? `${from} → ${formatDateIST(b.end_date, 'dd-MM-yyyy')}` : from;
};

interface Props { bookings: Booking[]; handlers: BookingHandlers }

// Phone layout: one card per booking with every action reachable without sideways scrolling.
const BookingCards: React.FC<Props> = ({ bookings, handlers }) => {
  const valueOf = useBookingValue();
  return (
    <div className="list-cards">
      {bookings.map(b => (
        <div key={b.id} className="list-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0 }}>
              <button type="button" onClick={() => handlers.onOpen(b)} style={{ background: 'none', border: 'none', padding: 0, fontWeight: 600, fontSize: 14, color: '#185FA5', cursor: 'pointer', textAlign: 'left' }}>{b.customer?.name ?? '—'} ›</button>
              {b.customer?.phone && <div style={{ fontSize: 12, color: '#888880' }}>{b.customer.phone}</div>}
            </div>
            <StatusPill status={b.status} />
          </div>
          <div style={{ fontSize: 13, marginTop: 8, color: '#1A1A18' }}>
            <span style={{ fontWeight: 500 }}>{b.event_type}</span>
            <span style={{ color: '#666660' }}> · {dateRange(b)}{b.event_time ? ` · ${fmtTime(b.event_time)}` : ''}</span>
          </div>
          {b.venue && <div style={{ fontSize: 12, color: '#666660', marginTop: 4, overflowWrap: 'anywhere' }}>📍 {b.venue}</div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, gap: 8 }}>
            <span style={{ fontSize: 12, color: '#666660' }}>👥 {b.guest_count} guests</span>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{inr(valueOf(b))}</span>
          </div>
          <div className="list-card-actions" style={{ alignItems: 'center' }}>
            <StatusSelect value={b.status} onChange={s => handlers.onStatus(b, s)} style={{ minHeight: 34, fontSize: 13 }} />
            <BookingActions booking={b} handlers={handlers} />
          </div>
        </div>
      ))}
    </div>
  );
};

export default BookingCards;
