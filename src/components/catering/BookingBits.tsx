import React from 'react';
import { STAGE_LABELS } from '../../lib/eventStage';
import { BookingView, STAGE_STYLE } from '../../lib/bookingBoard';
import { formatDateIST } from '../../lib/ist';
import { fmtTime } from './BookingCalendar';

// Small pieces shared by the list, calendar and pipeline views.
export const StageChip: React.FC<{ v: BookingView }> = ({ v }) => {
  const s = STAGE_STYLE[v.stage];
  return <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 12, whiteSpace: 'nowrap', background: s.bg, color: s.fg }}>{STAGE_LABELS[v.stage]}</span>;
};

export const NextButton: React.FC<{ v: BookingView; onRun: (v: BookingView) => void; primary?: boolean; style?: React.CSSProperties }> = ({ v, onRun, primary, style }) => (v.next ? (
  <button type="button" onClick={() => onRun(v)}
    style={{ minHeight: 44, padding: '8px 12px', borderRadius: 9, font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
      ...(primary ? { border: 'none', background: 'var(--primary)', color: '#fff' } : { border: '1px solid #E8A867', background: '#fff', color: '#8A4B00' }), ...style }}>
    {v.next.label}
  </button>
) : null);

// "11:30 AM · to 20 Dec · 175 guests · Green Lawns"
export const detailLine = (v: BookingView) => [
  fmtTime(v.b.event_time),
  v.end > v.start ? `to ${formatDateIST(v.end, 'd MMM')}` : '',
  v.b.guest_count > 0 ? `${v.b.guest_count} guests` : '',
  v.b.venue,
].filter(Boolean).join(' · ');

export const missingGuests = (v: BookingView) => !(v.b.guest_count > 0) && (v.tab === 'upcoming' || v.tab === 'attention');

export const DateBlock: React.FC<{ iso: string; small?: boolean }> = ({ iso, small }) => (
  <div className="bk-date" aria-hidden="true" style={{ width: small ? 48 : 56, padding: '6px 0', borderRadius: 10, background: '#F7F5F0', display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
    <span style={{ fontSize: 12, fontWeight: 600, color: '#8A4B00', letterSpacing: 0.6 }}>{formatDateIST(iso, 'MMM').toUpperCase()}</span>
    <span style={{ fontSize: small ? 19 : 22, fontWeight: 700, lineHeight: 1.1 }}>{formatDateIST(iso, 'd')}</span>
    <span style={{ fontSize: 12, color: '#6B6B66' }}>{formatDateIST(iso, 'EEE')}</span>
  </div>
);
