import React, { useState } from 'react';
import type { QuoteForm } from '../../hooks/useQuoteForm';
import { useEventTypes, DEFAULT_EVENTS } from '../../hooks/useDataCenter';
import { sameDayNote } from '../../lib/quoteOptions';
import { stageText } from '../../lib/quoteSummary';
import { maskPhone } from '../../lib/quotationShare';
import { formatDateIST } from '../../lib/ist';
import { fmtTime } from '../catering/BookingCalendar';
import { Field, useMedia, PHONE } from './bits';

interface Props { f: QuoteForm; onOpenBooking?: (id: string) => void; onSeveralDays: () => void }

const FOOD_TYPES = ['Regular', 'Jain', 'Swaminarayan'];

export const Tick: React.FC<{ ok: boolean }> = ({ ok }) => <span className={`q-tick${ok ? '' : ' warn'}`} aria-label={ok ? 'Done' : 'Needs a look'}>{ok ? '✓' : '!'}</span>;

// Who and when: the booking's details, edited here and saved back to the booking.
const EventSection: React.FC<Props> = ({ f, onOpenBooking, onSeveralDays }) => {
  const { data: typeRows = [] } = useEventTypes();
  const phone = useMedia(PHONE);
  const [open, setOpen] = useState(false);
  const { ev, selectedBooking: b } = f;
  const types = (typeRows.length ? typeRows.map(t => t.name) : DEFAULT_EVENTS).filter(t => t !== 'Other');
  const ok = !!ev.draft.date && (f.isMultiDay || f.guestCount > 0);
  const note = sameDayNote(f.isMultiDay ? (f.eventDays[0]?.date || '') : ev.draft.date, ev.draft.venue, f.quotations, f.bookings,
    { id: f.editingId ?? undefined, group: f.editingQuotation?.option_group, bookingId: b?.id });
  const summary = [ev.draft.eventType, ev.draft.date && formatDateIST(ev.draft.date, 'EEE d MMM')].filter(Boolean).join(' · ');
  const detail = [fmtTime(ev.draft.time), f.guestCount ? `${f.guestCount} guests` : 'guests not set', f.foodType].filter(Boolean).join(' · ');

  if (!b) {
    return (
      <section className="q-sec" aria-label="Event">
        <h2><Tick ok={false} />Event</h2>
        <Field label="Attach this quote to a booking">
          <select value={ev.bookingId} onChange={e => ev.selectBooking(e.target.value)}>
            <option value="">— Choose a booking —</option>
            {f.eligibleBookings.map(x => <option key={x.id} value={x.id}>{x.customer?.name} · {x.event_type} · {formatDateIST(x.event_date, 'd MMM yyyy')}</option>)}
          </select>
        </Field>
      </section>
    );
  }

  if (phone && !open) {
    return (
      <section className="q-sec q-sec-row" aria-label="Event">
        <span className="q-h">Event</span>
        <div className="q-sec-line">
          <span><b>{summary || 'No date yet'}</b><small>{detail}</small></span>
          <button type="button" className="q-mini" onClick={() => setOpen(true)}>Edit</button>
        </div>
      </section>
    );
  }

  return (
    <section className="q-sec" aria-label="Event">
      <div className="q-sec-head">
        <h2><Tick ok={ok} />Event</h2>
        {phone && <button type="button" className="q-mini" onClick={() => setOpen(false)}>Done</button>}
      </div>
      <div className="q-grid3">
        <div className="q-field">Customer<span className="q-ro">{b.customer?.name ?? '—'}{b.customer?.phone ? ` · ${maskPhone(b.customer.phone)}` : ''}</span></div>
        <Field label="Event">
          <input list="q-event-types" value={ev.draft.eventType} onChange={e => ev.patch({ eventType: e.target.value })} placeholder="Wedding, Vashtu…" />
        </Field>
        {!f.isMultiDay && <Field label="Date"><input type="date" value={ev.draft.date} onChange={e => ev.patch({ date: e.target.value })} /></Field>}
        {!f.isMultiDay && <Field label="Time"><input type="time" value={ev.draft.time} onChange={e => ev.patch({ time: e.target.value })} /></Field>}
        {!f.isMultiDay && <Field label="Guests"><input type="number" min={0} inputMode="numeric" value={ev.guests} onChange={e => ev.setGuests(e.target.value)} placeholder="0" /></Field>}
        <Field label="Venue"><input value={ev.draft.venue} onChange={e => ev.patch({ venue: e.target.value })} placeholder="Hall / area" /></Field>
      </div>
      <datalist id="q-event-types">{types.map(t => <option key={t} value={t} />)}</datalist>
      <span className="q-meta">
        Booking: {onOpenBooking ? <button type="button" className="lnk" onClick={() => onOpenBooking(b.id)}>{b.event_type}, {formatDateIST(b.event_date, 'd MMM')} — {stageText(b)}</button>
          : <>{b.event_type}, {formatDateIST(b.event_date, 'd MMM')} — {stageText(b)}</>}
        {' · '}Food style{' '}
        <select value={f.foodType} onChange={e => f.setFoodType(e.target.value)} aria-label="Food style">
          <option value="">Not set</option>
          {FOOD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {!f.isMultiDay && <>{' · '}<button type="button" className="lnk" onClick={onSeveralDays}>Several days?</button></>}
      </span>
      {note && <div role="status" className="q-warnbox">{note}</div>}
    </section>
  );
};

export default EventSection;
