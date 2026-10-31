import React, { useState } from 'react';
import { BookingView, pipelineColumns, STAGE_STYLE } from '../../lib/bookingBoard';
import { STAGE_LABELS, Stage } from '../../lib/eventStage';
import { formatDateIST } from '../../lib/ist';
import BookingMenu, { BoardActions } from './BookingMenu';
import '../../styles/bookings-dialogs.css';

interface Props { views: BookingView[]; actions: BoardActions; today: string; unbilled: number; onInvoices: () => void }

const EMPTY: Record<string, string> = {
  inquiry: 'No new enquiries', quoted: 'No quotes waiting', confirmed: 'Nothing confirmed yet', invoiced: 'Nothing waiting for payment',
};
const SHOWN = 3;

// Pipeline view: open work left to right (Inquiry → Paid), three cards a column, then "+ N more".
const BookingPipeline: React.FC<Props> = ({ views, actions: a, today, unbilled, onInvoices }) => {
  const [open, setOpen] = useState<Stage[]>([]);
  const everPaid = views.some(v => v.stage === 'paid');
  return (
    <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(220px, 1fr))', gap: 14, alignItems: 'start', minWidth: 1150 }}>
        {pipelineColumns(views, today).map(col => {
          const all = open.includes(col.stage);
          const cards = all ? col.cards : col.cards.slice(0, SHOWN);
          return (
            <section key={col.stage} aria-label={STAGE_LABELS[col.stage]} style={{ background: '#EFEEE8', borderRadius: 14, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ padding: '2px 4px 4px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: STAGE_STYLE[col.stage].dot }} />
                  {STAGE_LABELS[col.stage]} <span style={{ fontWeight: 500, color: '#6B6B66' }}>{col.cards.length}</span>
                </span>
                {col.note && <span style={{ fontSize: 12.5, color: '#4A4A45' }}>{col.note}</span>}
              </div>
              {col.cards.length === 0 && (col.stage === 'paid' ? (
                <div className="bk-paid-empty">
                  <span>{everPaid ? 'Nothing paid in full lately.' : 'Nothing paid in full yet.'}{unbilled > 0 && ` ${unbilled} finished event${unbilled > 1 ? 's were' : ' was'} never invoiced: settle ${unbilled > 1 ? 'them' : 'it'} in Invoices.`}</span>
                  {unbilled > 0 && <button type="button" className="ui-btn" style={{ minHeight: 44 }} onClick={onInvoices}>Go to Invoices</button>}
                </div>
              ) : <span style={{ fontSize: 13, color: '#6B6B66', padding: '12px 6px', textAlign: 'center' }}>{EMPTY[col.stage]}</span>)}
              {cards.map(v => {
                const late = v.tab === 'attention';
                return (
                  <div key={v.b.id} style={{ background: '#fff', border: `1px solid ${late ? '#F3D3AD' : '#E5E5E0'}`, borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: late ? '#8A4B00' : '#6B6B66' }}>
                        {late ? 'Date passed · ' : ''}{formatDateIST(v.start, late ? 'd MMM' : 'EEE, d MMM')}
                      </span>
                      <BookingMenu view={v} actions={a} />
                    </div>
                    <button type="button" onClick={() => a.open(v.b)} style={{ textAlign: 'left', background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer', color: '#1A1A18' }}>
                      <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600 }}>{v.b.customer?.name ?? '—'}</span>
                      <span style={{ display: 'block', fontSize: 13, color: '#4A4A45' }}>{v.b.event_type}{v.b.guest_count > 0 ? ` · ${v.b.guest_count} guests` : ''}</span>
                    </button>
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>{v.valueText}</span>
                    {v.next && (
                      <button type="button" onClick={() => a.run(v)}
                        style={{ alignSelf: 'flex-start', border: 'none', background: 'none', padding: '4px 0', font: 'inherit', fontSize: 13, fontWeight: 600, color: late ? '#8A4B00' : '#A84F00', cursor: 'pointer', minHeight: 44 }}>
                        {v.next.label} →
                      </button>
                    )}
                  </div>
                );
              })}
              {col.cards.length > SHOWN && (
                <button type="button" className="bk-more" aria-expanded={all}
                  onClick={() => setOpen(o => (all ? o.filter(s => s !== col.stage) : [...o, col.stage]))}>
                  {all ? 'Show fewer' : `+ ${col.cards.length - SHOWN} more`}
                </button>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
};

export default BookingPipeline;
