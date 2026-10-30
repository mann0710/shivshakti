import React from 'react';
import { BookingView, pipelineColumns, STAGE_STYLE } from '../../lib/bookingBoard';
import { STAGE_LABELS } from '../../lib/eventStage';
import { formatDateIST } from '../../lib/ist';
import { inr } from '../../lib/money';
import BookingMenu, { BoardActions } from './BookingMenu';

interface Props { views: BookingView[]; actions: BoardActions; today: string }

const EMPTY: Record<string, string> = {
  inquiry: 'No new enquiries', quoted: 'No quotes waiting', confirmed: 'Nothing confirmed yet', invoiced: 'Nothing waiting for payment', paid: 'Nothing paid in 60 days',
};

// Pipeline view: open work left to right (Inquiry → Paid), each card with its next step.
const BookingPipeline: React.FC<Props> = ({ views, actions: a, today }) => (
  <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(220px, 1fr))', gap: 14, alignItems: 'start', minWidth: 1150 }}>
      {pipelineColumns(views, today).map(col => (
        <section key={col.stage} aria-label={STAGE_LABELS[col.stage]} style={{ background: '#EFEEE8', borderRadius: 14, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ padding: '2px 4px 4px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: STAGE_STYLE[col.stage].dot }} />
              {STAGE_LABELS[col.stage]} <span style={{ fontWeight: 500, color: '#6B6B66' }}>{col.cards.length}</span>
            </span>
            {col.total > 0 && <span style={{ fontSize: 12.5, color: '#4A4A45' }}>{inr(col.total)}</span>}
          </div>
          {col.cards.length === 0 && <span style={{ fontSize: 13, color: '#6B6B66', padding: '12px 6px', textAlign: 'center' }}>{EMPTY[col.stage]}</span>}
          {col.cards.map(v => {
            const late = v.tab === 'attention';
            return (
              <div key={v.b.id} style={{ background: '#fff', border: `1px solid ${late ? '#F3D3AD' : '#E5E5E0'}`, borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: late ? '#8A4B00' : '#6B6B66' }}>
                    {late ? 'Date passed · ' : ''}{formatDateIST(v.start, late ? 'd MMM' : 'EEE, d MMM')}
                  </span>
                  <BookingMenu view={v} actions={a} size={32} />
                </div>
                <button type="button" onClick={() => a.open(v.b)} style={{ textAlign: 'left', background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer', color: '#1A1A18' }}>
                  <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600 }}>{v.b.customer?.name ?? '—'}</span>
                  <span style={{ display: 'block', fontSize: 13, color: '#4A4A45' }}>{v.b.event_type}{v.b.guest_count > 0 ? ` · ${v.b.guest_count} guests` : ''}</span>
                </button>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{v.valueText}</span>
                {v.next && (
                  <button type="button" onClick={() => a.run(v)}
                    style={{ alignSelf: 'flex-start', border: 'none', background: 'none', padding: '4px 0', font: 'inherit', fontSize: 13, fontWeight: 600, color: late ? '#8A4B00' : '#A84F00', cursor: 'pointer', minHeight: 32 }}>
                    {v.next.label} →
                  </button>
                )}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  </div>
);

export default BookingPipeline;
