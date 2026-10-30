import React from 'react';
import { MonthGroup } from '../../lib/bookingBoard';
import BookingMenu, { BoardActions } from './BookingMenu';
import { StageChip, NextButton, DateBlock, detailLine, missingGuests } from './BookingBits';

interface Props { groups: MonthGroup[]; actions: BoardActions; empty: string }

// List view: month headings, then one row per event — date, who and what, value, stage, next step, ⋯.
const BookingAgenda: React.FC<Props> = ({ groups, actions: a, empty }) => {
  if (!groups.length) return <div style={emptyBox}>{empty}</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {groups.map(g => (
        <section key={g.key} aria-label={g.title} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 4px', gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{g.title}</h2>
            <span style={{ fontSize: 13, color: '#6B6B66' }}>
              {g.views.length} event{g.views.length === 1 ? '' : 's'}{g.guests ? ` · ${g.guests.toLocaleString('en-IN')} guests` : ''}
            </span>
          </div>
          <div style={{ background: '#fff', border: '1px solid #E5E5E0', borderRadius: 14 }}>
            {g.views.map((v, i) => (
              <div key={v.b.id} className="bk-row" style={{ borderTop: i ? '1px solid #F0EFEA' : 'none' }}>
                <DateBlock iso={v.start} />
                <button type="button" className="bk-main" onClick={() => a.open(v.b)} title="Open event page"
                  style={{ textAlign: 'left', background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer', color: '#1A1A18', minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 600 }}>
                    {v.b.customer?.name ?? '—'} <span style={{ fontWeight: 400, color: '#4A4A45' }}>· {v.b.event_type}</span>
                  </span>
                  {detailLine(v) && <span style={{ display: 'block', fontSize: 13, color: '#6B6B66', marginTop: 2 }}>{detailLine(v)}</span>}
                  {missingGuests(v) && <span style={{ display: 'block', fontSize: 12.5, color: '#8A4B00', marginTop: 2 }}>Guest count missing</span>}
                </button>
                <span className="bk-amt" style={{ fontSize: 15, fontWeight: 600 }}>{v.valueText}</span>
                <span className="bk-stage"><StageChip v={v} /></span>
                <div className="bk-acts" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <NextButton v={v} onRun={a.run} style={{ flex: 1 }} />
                  <BookingMenu view={v} actions={a} />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

const emptyBox: React.CSSProperties = { background: '#fff', border: '1px solid #E5E5E0', borderRadius: 14, padding: 40, textAlign: 'center', color: '#6B6B66', fontSize: 14 };

export default BookingAgenda;
