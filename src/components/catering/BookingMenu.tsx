import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Booking } from '../../types';
import { BookingView } from '../../lib/bookingBoard';
import { waNumber } from '../../lib/quoteMath';
import { BOOKING_STATUSES, cap } from './BookingActions';

// Everything the Bookings screen can do to one booking; `run` performs its next step.
export interface BoardActions {
  run: (v: BookingView) => void;
  open: (b: Booking) => void;
  edit: (b: Booking) => void;
  quote: (b: Booking) => void;
  invoice: (b: Booking) => void;
  menuPdf: (v: BookingView) => void;
  status: (b: Booking, s: Booking['status']) => void;
  remove: (b: Booking) => void;
  calendarHref: (b: Booking) => string;
  newOn: (iso: string) => void;
}

interface Props { view: BookingView; actions: BoardActions; size?: number }

// "⋯" beside a booking: the less common actions, in a menu that floats above scrolling lists.
const BookingMenu: React.FC<Props> = ({ view: v, actions: a, size = 40 }) => {
  const [at, setAt] = useState<React.CSSProperties | null>(null);
  const [statuses, setStatuses] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const b = v.b;
  const phone = b.customer?.phone?.trim();
  const close = () => { setAt(null); setStatuses(false); };

  useEffect(() => {
    if (!at) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('resize', close); window.removeEventListener('scroll', close, true); };
  }, [at]);

  const toggle = () => {
    if (at) return close();
    const r = btn.current!.getBoundingClientRect();
    const below = window.innerHeight - r.bottom > 380;
    setAt({ right: Math.max(8, window.innerWidth - r.right), ...(below ? { top: r.bottom + 6 } : { bottom: window.innerHeight - r.top + 6 }) });
  };
  const item = (label: string, act: () => void, danger = false) => (
    <button type="button" role="menuitem" onClick={() => { close(); act(); }} style={{ ...mi, color: danger ? '#A32D2D' : '#1A1A18' }}>{label}</button>
  );
  const link = (label: string, href: string) => (
    <a role="menuitem" href={href} target="_blank" rel="noopener noreferrer" onClick={close} style={{ ...mi, textDecoration: 'none' }}>{label}</a>
  );
  const live = v.stage !== 'cancelled' && b.status !== 'completed';

  return (
    <>
      <button ref={btn} type="button" aria-label={`More actions for ${b.customer?.name ?? 'booking'}`} aria-haspopup="menu" aria-expanded={!!at} onClick={toggle}
        style={{ width: size, height: size, flexShrink: 0, border: '1px solid #E5E5E0', background: at ? '#F7F5F0' : '#fff', borderRadius: 9, cursor: 'pointer', fontSize: 18, lineHeight: 1, color: '#4A4A45' }}>⋯</button>
      {at && createPortal(
        <>
          <div onMouseDown={close} style={{ position: 'fixed', inset: 0, zIndex: 450 }} />
          <div role="menu" aria-label={`Actions for ${b.customer?.name ?? 'booking'}`}
            style={{ position: 'fixed', ...at, zIndex: 451, width: 240, maxHeight: '70vh', overflowY: 'auto', background: '#fff', border: '1px solid #E0E0DA', borderRadius: 12, boxShadow: '0 12px 32px rgba(26,26,24,0.16)', padding: 6, display: 'flex', flexDirection: 'column' }}>
            {item('Open event page', () => a.open(b))}
            {item('Edit details', () => a.edit(b))}
            {live && v.next?.kind !== 'quote' && item('Make quotation', () => a.quote(b))}
            {v.stage === 'confirmed' && v.next?.kind !== 'invoice' && item('Create invoice', () => a.invoice(b))}
            {v.quote && item('Kitchen menu PDF', () => a.menuPdf(v))}
            {phone && link('WhatsApp', `https://wa.me/${waNumber(phone)}`)}
            {phone && <a role="menuitem" href={`tel:${phone.replace(/[^\d+]/g, '')}`} onClick={close} style={{ ...mi, textDecoration: 'none' }}>Call</a>}
            {link('Add to Google Calendar', a.calendarHref(b))}
            <button type="button" role="menuitem" aria-expanded={statuses} onClick={() => setStatuses(s => !s)} style={mi}>Change status {statuses ? '▴' : '▾'}</button>
            {statuses && BOOKING_STATUSES.map(s => (
              <button key={s} type="button" role="menuitemradio" aria-checked={b.status === s} onClick={() => { close(); if (b.status !== s) a.status(b, s); }}
                style={{ ...mi, paddingLeft: 26, fontWeight: b.status === s ? 700 : 400 }}>{b.status === s ? '✓ ' : ''}{cap(s)}</button>
            ))}
            <div style={{ height: 1, background: '#EEEEE8', margin: '4px 6px' }} />
            {item('Delete booking', () => a.remove(b), true)}
          </div>
        </>, document.body)}
    </>
  );
};

const mi: React.CSSProperties = { display: 'block', textAlign: 'left', border: 'none', background: 'none', font: 'inherit', fontSize: 14, color: '#1A1A18', padding: '10px 12px', borderRadius: 8, cursor: 'pointer' };

export default BookingMenu;
