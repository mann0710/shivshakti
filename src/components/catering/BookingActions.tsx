import React from 'react';
import { Booking } from '../../types';
import { waNumber } from '../../lib/quoteMath';

export const BOOKING_STATUSES: Booking['status'][] = ['inquiry', 'followup', 'confirmed', 'completed', 'cancelled'];
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export interface BookingHandlers {
  onStatus: (b: Booking, status: Booking['status']) => void;
  onEdit: (b: Booking) => void;
  onOpen: (b: Booking) => void;
  onDelete: (b: Booking) => void;
  onQuote?: (b: Booking) => void;
  onInvoice?: (b: Booking) => void;
  calendarHref: (b: Booking) => string;
}

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

interface ActProps { icon: string; label: string; compact?: boolean; href?: string; onClick?: () => void; tone?: React.CSSProperties }

const Act: React.FC<ActProps> = ({ icon, label, compact, href, onClick, tone }) => {
  const style = { ...(compact ? iconBtn : chip), ...tone };
  const body = compact ? icon : `${icon} ${label}`;
  if (!href) return <button type="button" title={label} aria-label={label} style={style} onClick={onClick}>{body}</button>;
  const external = href.startsWith('http');
  return (
    <a href={href} title={label} aria-label={label} style={style}
      target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}>{body}</a>
  );
};

interface Props { booking: Booking; handlers: BookingHandlers; compact?: boolean }

// Icon-only in the desktop table, labelled chips on phone cards.
const BookingActions: React.FC<Props> = ({ booking: b, handlers: h, compact }) => {
  const phone = b.customer?.phone;
  const canQuote = !!h.onQuote && b.status !== 'completed' && b.status !== 'cancelled';
  return (
    <>
      <Act compact={compact} icon="✏" label="Edit" onClick={() => h.onEdit(b)} tone={compact ? { color: '#378ADD' } : undefined} />
      {canQuote && <Act compact={compact} icon="📝" label="Quote" onClick={() => h.onQuote?.(b)} />}
      {h.onInvoice && b.status === 'confirmed' && <Act compact={compact} icon="🧾" label="Invoice" onClick={() => h.onInvoice?.(b)} />}
      <Act compact={compact} icon="📅" label="Google Calendar" href={h.calendarHref(b)} />
      {phone && <Act compact={compact} icon="💬" label="WhatsApp" href={`https://wa.me/${waNumber(phone)}`} />}
      {phone && <Act compact={compact} icon="📞" label="Call" href={`tel:${phone.replace(/[^\d+]/g, '')}`} />}
      <Act compact={compact} icon={compact ? '×' : '🗑'} label="Delete" onClick={() => h.onDelete(b)}
        tone={compact ? { color: '#A32D2D', fontSize: 17 } : danger} />
    </>
  );
};

const iconBtn: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '2px 5px', textDecoration: 'none', lineHeight: 1, verticalAlign: 'middle' };
const chip: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 34, padding: '6px 10px', borderRadius: 8, fontSize: 12,
  background: '#FFF7EE', border: '0.5px solid #F5D3B0', color: '#9A4F05', textDecoration: 'none', cursor: 'pointer', boxSizing: 'border-box',
};
const danger: React.CSSProperties = { background: '#FCEBEB', border: '0.5px solid #F0C4C4', color: '#A32D2D' };

export default BookingActions;
