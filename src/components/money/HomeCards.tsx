import React from 'react';
import Modal from '../ui/Modal';
import { Navigate } from '../../hooks/useNavIntent';
import { BookingView, STAGE_STYLE } from '../../lib/bookingBoard';
import { STAGE_LABELS, Stage } from '../../lib/eventStage';
import { SweetRow } from '../../lib/homeNeeds';
import { inr } from '../../lib/money';
import { posLink } from '../../lib/posIntent';
import { CardHead, Chip, DateTile, Empty } from './MoneyUi';

export interface EventRow { view: BookingView; stage: Stage; note: string }

const HeadLink: React.FC<{ text: string; onClick: () => void }> = ({ text, onClick }) => (
  <button type="button" className="mx-link" onClick={onClick}>{text} →</button>
);

// Home "Next events": the next five events with what each is missing.
export const NextEvents: React.FC<{ rows: EventRow[]; onNavigate: Navigate }> = ({ rows, onNavigate }) => (
  <section aria-label="Next events" className="mx-card hm-list">
    <CardHead title="Next events" right={<HeadLink text="Bookings" onClick={() => onNavigate('bookings')} />} />
    {!rows.length && <Empty title="No events coming up" text="New inquiries show up here." />}
    {rows.map(({ view: v, stage, note }) => (
      <button key={v.b.id} type="button" className="hm-ev" onClick={() => onNavigate('bookings', { action: 'open', id: v.b.id })}>
        <DateTile iso={v.b.event_date} />
        <span className="mx-two-line"><b>{v.b.customer?.name ?? 'Customer'} · {v.b.event_type}</b><span>{note}</span></span>
        <Chip bg={STAGE_STYLE[stage].bg} fg={STAGE_STYLE[stage].fg}>{STAGE_LABELS[stage]}</Chip>
      </button>
    ))}
  </section>
);

// Home "Sweets this week": pre-bookings due in seven days, then unpaid bills.
export const SweetsWeek: React.FC<{ rows: SweetRow[]; onNavigate: Navigate }> = ({ rows, onNavigate }) => (
  <section aria-label="Sweets this week" className="mx-card hm-list">
    <CardHead title="Sweets this week" right={<HeadLink text="Sweets today" onClick={() => onNavigate('seasonal_dashboard')} />} />
    {!rows.length && <Empty title="Nothing due this week" text="No pre-bookings in the next 7 days and no unpaid bills." />}
    {rows.map(r => (
      <div key={r.key} className="hm-sw">
        <span className={`when${r.when === 'Unpaid' ? ' late' : ''}`}>{r.when}</span>
        <span className="mx-two-line"><b style={{ fontSize: 14 }}>{r.name}</b><span>{r.line}</span></span>
        <span className="amt">{inr(r.amount)}</span>
      </div>
    ))}
  </section>
);

const NEW: [string, string, Parameters<Navigate>][] = [
  ['Sweets bill', 'Opens the counter', ['seasonal_billing', posLink.bill()]],
  ['Pre-booking', 'Sweets for a later day', ['seasonal_billing', posLink.preorder()]],
  ['Booking', 'A catering inquiry', ['bookings', { action: 'new' }]],
  ['Quotation', 'For a booking or a new event', ['quotations', { action: 'new' }]],
];

// Phone "+ New" sheet (DlgExtras).
export const NewSheet: React.FC<{ onNavigate: Navigate; onClose: () => void }> = ({ onNavigate, onClose }) => (
  <Modal title="New" onClose={onClose} footer={<button type="button" className="ui-btn primary" style={{ flex: 1 }} onClick={onClose}>Close</button>}>
    <div className="mx-cards">
      {NEW.map(([title, line, to]) => (
        <button key={title} type="button" className="mx-rcard" onClick={() => { onClose(); onNavigate(...to); }}>
          <i aria-hidden="true" /><span><b>{title}</b><small>{line}</small></span><span />
        </button>
      ))}
    </div>
  </Modal>
);
