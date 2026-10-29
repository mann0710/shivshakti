import React from 'react';
import { Booking } from '../../types';
import { formatDateIST } from '../../lib/ist';

interface Props {
  bookings: Booking[];
  bookingId: string;
  onBooking: (id: string) => void;
  booking?: Booking;
  foodType: string;
  onFoodType: (v: string) => void;
  isMultiDay: boolean;
  onMultiDay: (checked: boolean) => void;
}

const FOOD_TYPES = ['Regular', 'Jain', 'Swaminarayan'];
const muted: React.CSSProperties = { color: '#888880' };

// Booking + food type pickers, booking summary and the multi-day switch.
const QuotationBookingFields: React.FC<Props> = ({ bookings, bookingId, onBooking, booking, foodType, onFoodType, isMultiDay, onMultiDay }) => (
  <>
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
      <div style={{ flex: '1 1 280px', maxWidth: 420 }}>
        <label style={lbl}>SELECT BOOKING</label>
        <select value={bookingId} onChange={e => onBooking(e.target.value)} style={inp}>
          <option value="">— Choose a booking —</option>
          {bookings.map(b => (
            <option key={b.id} value={b.id}>{b.customer?.name} · {b.event_type} · {formatDateIST(b.event_date, 'dd-MM-yyyy')}</option>
          ))}
        </select>
      </div>
      <div style={{ flex: '0 1 200px' }}>
        <label style={lbl}>FOOD TYPE</label>
        <select value={foodType} onChange={e => onFoodType(e.target.value)} style={inp}>
          <option value="">— Select food type —</option>
          {FOOD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
    </div>

    {booking && (
      <div style={{ background: '#F9F8F5', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#444', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 6 }}>
        <div><span style={muted}>Customer: </span>{booking.customer?.name}</div>
        <div><span style={muted}>Event: </span>{booking.event_type}</div>
        <div><span style={muted}>Date: </span>{formatDateIST(booking.event_date, 'dd-MM-yyyy')}</div>
        {booking.venue && <div><span style={muted}>Venue: </span>{booking.venue}</div>}
        <div><span style={muted}>Guests: </span><strong>{booking.guest_count || 0}</strong></div>
      </div>
    )}

    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', userSelect: 'none', flexWrap: 'wrap', marginBottom: 16 }}>
      <input type="checkbox" checked={isMultiDay} onChange={e => onMultiDay(e.target.checked)} style={{ accentColor: '#E8750A', width: 15, height: 15 }} />
      <span style={{ fontWeight: 600 }}>Multi-day / Multi-meal event</span>
      <span style={{ fontSize: 11, color: '#888880' }}>(e.g. 2–3 day function with breakfast, lunch, dinner)</span>
    </label>
  </>
);

const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#888880', display: 'block', marginBottom: 4 };
const inp: React.CSSProperties = { width: '100%', border: '1px solid #E5E5E0', borderRadius: 8, padding: '8px 10px', fontSize: 13, boxSizing: 'border-box', background: '#fff' };

export default QuotationBookingFields;
