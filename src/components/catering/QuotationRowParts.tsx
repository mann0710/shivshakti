import React from 'react';
import { Quotation } from '../../hooks/useQuotations';
import { quotationDates } from '../../lib/quotationShare';
import { statusText, plateText } from '../../lib/quoteOptions';

export const STATUSES = ['draft', 'sent', 'accepted', 'rejected'] as const;
export const STATUS_COLORS: Record<string, string> = {
  draft: '#888880', sent: '#378ADD', accepted: '#639922', rejected: '#CC4444',
};

// `options` set = one PDF / share for every option of the enquiry.
export interface Actions {
  onPdf: (q: Quotation, options?: Quotation[]) => void;
  onShare: (q: Quotation, options?: Quotation[]) => void;
  onEdit: (q: Quotation) => void;
  onClone: (q: Quotation) => void;
  onDelete: (q: Quotation) => void;
}

export const StatusSelect: React.FC<{ q: Quotation; onStatus: (q: Quotation, status: string) => void }> = ({ q, onStatus }) => (
  <select value={q.status} onChange={e => onStatus(q, e.target.value)} aria-label="Status"
    style={{ border: '0.5px solid #E5E5E0', borderRadius: 6, background: '#fff', fontSize: 12, fontWeight: 600, color: STATUS_COLORS[q.status] || '#888880', cursor: 'pointer', padding: '3px 6px' }}>
    {STATUSES.map(s => <option key={s} value={s}>{statusText({ status: s, option_group: q.option_group })}</option>)}
  </select>
);

export const actionBtn = (color: string, filled = false, big = false): React.CSSProperties => ({
  background: filled ? color : '#fff', color: filled ? '#fff' : color,
  border: `1px solid ${filled ? color : '#E5E5E0'}`, borderRadius: big ? 8 : 5,
  padding: big ? '6px 12px' : '3px 8px', fontSize: big ? 13 : 11, fontWeight: filled ? 600 : 500,
  cursor: 'pointer', whiteSpace: 'nowrap',
});

// Buttons for one quote, or for one option of an enquiry (its own PDF only).
export const RowActions: React.FC<Actions & { q: Quotation; big?: boolean }> = ({ q, big, onPdf, onShare, onEdit, onClone, onDelete }) => {
  const one = q.option_label ? ` Option ${q.option_label}` : '';
  return (
    <>
      <button onClick={() => onShare(q)} style={actionBtn('#1DA851', true, big)} title={`Send${one || ' the'} PDF on WhatsApp`}>📤 Share</button>
      <button onClick={() => onPdf(q)} style={actionBtn('#378ADD', false, big)} title={`Download${one || ' the'} PDF`}>⬇ PDF</button>
      <button onClick={() => onEdit(q)} style={actionBtn('#444', false, big)}>✏ Edit</button>
      <button onClick={() => onClone(q)} style={actionBtn('#0F6E56', false, big)} title="Copy as a new, separate quotation">⧉ Clone</button>
      <button onClick={() => onDelete(q)} style={actionBtn('#CC4444', false, big)}>🗑 Delete</button>
    </>
  );
};

export const eventLabel = (q: Quotation) => {
  if (!q.booking) return '—';
  const dates = quotationDates(q);
  return dates ? `${q.booking.event_type} · ${dates}` : q.booking.event_type;
};

export const typeLabel = (q: Quotation) => q.is_multi_day
  ? <span style={{ background: '#E6F1FB', color: '#185FA5', fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 600, whiteSpace: 'nowrap' }}>Multi-day ({q.event_days?.length || 0}d)</span>
  : q.per_plate_amount > 0 ? `${plateText(q)}/plate` : '—';

export const panel: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '0.5px solid #E5E5E0' };
export const cell: React.CSSProperties = { padding: '10px 12px', whiteSpace: 'nowrap', verticalAlign: 'middle' };
export const sub: React.CSSProperties = { fontSize: 11, color: '#888880', marginTop: 2 };
export const optChip: React.CSSProperties = { display: 'inline-block', fontSize: 10.5, fontWeight: 600, padding: '1px 7px', borderRadius: 8, background: '#FFF1E3', color: '#A84F00', marginTop: 2 };
