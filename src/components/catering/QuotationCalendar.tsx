import React, { useMemo, useState } from 'react';
import { Quotation } from '../../hooks/useQuotations';
import { quoteDays, optionTitle, statusText, totalText } from '../../lib/quoteOptions';
import { todayIST } from '../../lib/ist';
import { ORANGE } from './CustomerUi';

interface Props { quotations: Quotation[]; onOpen: (q: Quotation) => void; onNew: (date: string) => void }

// Status colours: background, text, dot.
const TONE: Record<string, [string, string, string]> = {
  draft: ['#F1F1EC', '#4F4F4A', '#8A8A84'], sent: ['#E7F0FB', '#1F4F8A', '#2F6FB8'],
  accepted: ['#EBF4E1', '#2F5A0E', '#3B6D11'], rejected: ['#FBEAEA', '#8E2A2A', '#B33A3A'],
};
const tone = (s: string) => TONE[s] ?? TONE.draft;
const iso = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Month of quotes by event date; tap a day for its quotes and a new quote on that date.
const QuotationCalendar: React.FC<Props> = ({ quotations, onOpen, onNew }) => {
  const today = todayIST();
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [day, setDay] = useState(today);
  const [y, m] = month.split('-').map(Number);

  const byDay = useMemo(() => {
    const map = new Map<string, Quotation[]>();
    quotations.forEach(q => quoteDays(q).forEach(d => map.set(d, [...(map.get(d) ?? []), q])));
    return map;
  }, [quotations]);

  const cells = useMemo(() => {
    const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const count = Math.ceil((lead + days) / 7) * 7;
    return Array.from({ length: count }, (_, i) => iso(y, m - 1, i - lead + 1));
  }, [y, m]);

  const shift = (n: number) => { const d = new Date(Date.UTC(y, m - 1 + n, 1)); setMonth(d.toISOString().slice(0, 7)); };
  const list = byDay.get(day) ?? [];
  const live = list.filter(q => q.status !== 'rejected');
  const accepted = list.filter(q => q.status === 'accepted');
  const label = new Date(`${day}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="qcal">
      <section className="qcal-month">
        <div className="qcal-bar">
          <button type="button" aria-label="Previous month" onClick={() => shift(-1)} style={nav}>‹</button>
          <b style={{ minWidth: 140, textAlign: 'center' }}>{new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</b>
          <button type="button" aria-label="Next month" onClick={() => shift(1)} style={nav}>›</button>
          <button type="button" onClick={() => { setMonth(today.slice(0, 7)); setDay(today); }} style={{ ...nav, width: 'auto', padding: '0 12px', fontSize: 12 }}>Today</button>
          <span className="qcal-legend">{(['draft', 'sent', 'accepted', 'rejected'] as const).map(s => (
            <span key={s}><i style={{ background: tone(s)[2] }} />{s === 'rejected' ? 'Not chosen / rejected' : s.charAt(0).toUpperCase() + s.slice(1)}</span>
          ))}</span>
        </div>
        <div className="qcal-grid">
          {WEEK.map(w => <span key={w} className="qcal-wd">{w}</span>)}
          {cells.map(d => {
            const qs = byDay.get(d) ?? [];
            const inMonth = d.slice(0, 7) === month;
            return (
              <button key={d} type="button" onClick={() => setDay(d)} aria-label={`${d}: ${qs.length} quotes`} aria-pressed={d === day}
                className={`qcal-day${d === day ? ' on' : ''}${inMonth ? '' : ' out'}${d === today ? ' today' : ''}`}>
                <span className="qcal-num">{Number(d.slice(8))}{qs.length > 1 && <em>{qs.length}</em>}</span>
                {qs.slice(0, 3).map(q => (
                  <span key={q.id} className="qcal-chip" style={{ background: tone(q.status)[0], color: tone(q.status)[1], textDecoration: q.status === 'rejected' ? 'line-through' : undefined }}>
                    <i style={{ background: tone(q.status)[2] }} /><span>{q.customer?.name?.split(' ')[0] || 'Quote'}{q.booking?.event_type ? ` · ${q.booking.event_type}` : ''}</span>
                  </span>
                ))}
                {qs.length > 3 && <span className="qcal-more">+{qs.length - 3} more</span>}
              </button>
            );
          })}
        </div>
      </section>

      <aside className="qcal-panel">
        <div style={{ padding: '14px 16px', borderBottom: '0.5px solid #E5E5E0' }}>
          <b style={{ fontSize: 15 }}>{label}</b>
          <div style={{ fontSize: 12, color: '#6B6B66' }}>{list.length} quote{list.length === 1 ? '' : 's'}{accepted.length ? ` · ${accepted.length} accepted` : ''}</div>
        </div>
        {live.length > 1 && (
          <div role="status" style={{ margin: '12px 16px 0', padding: '9px 12px', borderRadius: 8, background: '#FFF6E5', border: '0.5px solid #F2C77E', fontSize: 12, color: '#6D4C00', lineHeight: 1.45 }}>
            <b>Busy day.</b>{accepted.length ? ` ${accepted.map(q => q.booking?.venue || q.customer?.name).filter(Boolean).join(', ')} already accepted.` : ''} You can still quote — nothing is final until accepted.
          </div>
        )}
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.length === 0 && <span style={{ fontSize: 13, color: '#8A8A84' }}>No quotes on this day.</span>}
          {list.map(q => (
            <div key={q.id} style={{ border: '0.5px solid #E5E5E0', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: ORANGE }}>{q.quotation_number}{q.option_label ? ` · ${optionTitle(q)}` : ''}</span>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: tone(q.status)[0], color: tone(q.status)[1], whiteSpace: 'nowrap' }}>{statusText(q)}</span>
              </div>
              <b style={{ fontSize: 14 }}>{q.customer?.name || 'Customer'}</b>
              <span style={{ fontSize: 12, color: '#555550' }}>{[q.booking?.event_type, q.booking?.venue, q.booking?.guest_count ? `${q.booking.guest_count} guests` : ''].filter(Boolean).join(' · ')}</span>
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>{totalText(q)}</span>
              <button type="button" onClick={() => onOpen(q)} style={{ alignSelf: 'flex-start', marginTop: 4, height: 32, padding: '0 12px', border: '0.5px solid #D0D0CC', borderRadius: 7, background: '#fff', fontSize: 12, cursor: 'pointer' }}>Open</button>
            </div>
          ))}
        </div>
        <div style={{ padding: '12px 16px', borderTop: '0.5px solid #E5E5E0', marginTop: 'auto' }}>
          <button type="button" onClick={() => onNew(day)} style={{ width: '100%', height: 44, border: 'none', borderRadius: 8, background: ORANGE, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            + New quote on {new Date(`${day}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </button>
        </div>
      </aside>
    </div>
  );
};

const nav: React.CSSProperties = { width: 36, height: 36, border: '0.5px solid #D0D0CC', borderRadius: 8, background: '#fff', fontSize: 16, cursor: 'pointer' };

export default QuotationCalendar;
