import React from 'react';
import { Booking } from '../../types';

// Booking statuses and the status picker used by the booking form and the ⋯ menu.
export const BOOKING_STATUSES: Booking['status'][] = ['inquiry', 'followup', 'confirmed', 'completed', 'cancelled'];
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const StatusSelect: React.FC<{ value: Booking['status']; onChange: (s: Booking['status']) => void; style?: React.CSSProperties }> = ({ value, onChange, style }) => {
  // Legacy statuses (e.g. "pending") still show as the current value.
  const opts = BOOKING_STATUSES.includes(value) ? BOOKING_STATUSES : [value, ...BOOKING_STATUSES];
  return (
    <select value={value} aria-label="Change status" onChange={e => onChange(e.target.value as Booking['status'])}
      style={{ fontSize: 12, padding: '4px 6px', borderRadius: 6, border: '0.5px solid #D0D0CC', background: '#fff', cursor: 'pointer', color: '#1A1A18', ...style }}>
      {opts.map(s => <option key={s} value={s}>{cap(s)}</option>)}
    </select>
  );
};
