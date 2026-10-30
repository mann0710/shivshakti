import React from 'react';
import { Booking } from '../../types';
import { formatDateIST } from '../../lib/ist';
import { useCustomers } from '../../hooks/useCustomers';
import { useEventTypes, DEFAULT_EVENTS } from '../../hooks/useDataCenter';
import { QuoteEvent } from '../../hooks/useQuoteEvent';

interface Props {
  ev: QuoteEvent;
  bookings: Booking[];
  editing: boolean;
  foodType: string;
  onFoodType: (v: string) => void;
  isMultiDay: boolean;
  onMultiDay: (checked: boolean) => void;
  itemPrices: boolean;
  onItemPrices: (on: boolean) => void;
  lockItemPrices: boolean;
}

const FOOD_TYPES = ['Regular', 'Jain', 'Swaminarayan'];
const NEW = '__new';

// Who and what the quote is for: type it in (booking made on save) or pick an existing booking.
const QuotationEventFields: React.FC<Props> = ({ ev, bookings, editing, foodType, onFoodType, isMultiDay, onMultiDay, itemPrices, onItemPrices, lockItemPrices }) => {
  const { data: customers = [] } = useCustomers();
  const { data: typeRows = [] } = useEventTypes();
  const types = (typeRows.length ? typeRows.map(t => t.name) : DEFAULT_EVENTS).filter(t => t !== 'Other');
  const { draft, patch } = ev;
  const isNew = ev.mode === 'new';

  return (
    <>
      {!editing && (
        <div role="tablist" style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {([['new', 'New event'], ['existing', 'Existing booking']] as const).map(([m, label]) => (
            <button key={m} type="button" role="tab" aria-selected={ev.mode === m} onClick={() => ev.setMode(m)}
              style={{ ...chip, background: ev.mode === m ? '#E8750A' : '#fff', color: ev.mode === m ? '#fff' : '#666660', borderColor: ev.mode === m ? '#E8750A' : '#D0D0CC' }}>
              {label}
            </button>
          ))}
        </div>
      )}

      {isNew ? (
        <div className="g3" style={{ gap: 10, marginBottom: 12 }}>
          <Field label="CUSTOMER *">
            <select style={inp} value={draft.newCustomer ? NEW : draft.customerId}
              onChange={e => patch(e.target.value === NEW ? { newCustomer: true, customerId: '' } : { newCustomer: false, customerId: e.target.value })}>
              <option value="">— Choose customer —</option>
              <option value={NEW}>+ New customer</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ''}</option>)}
            </select>
          </Field>
          {draft.newCustomer && <>
            <Field label="NEW CUSTOMER NAME *"><input style={inp} autoFocus value={draft.name} onChange={e => patch({ name: e.target.value })} placeholder="e.g. Rajesh Patel" /></Field>
            <Field label="PHONE"><input style={inp} type="tel" inputMode="tel" value={draft.phone} onChange={e => patch({ phone: e.target.value })} placeholder="98765 43210" /></Field>
          </>}
          <Field label="EVENT">
            <input style={inp} list="quote-event-types" value={draft.eventType} onChange={e => patch({ eventType: e.target.value })} placeholder="Wedding, Vashtu…" />
            <datalist id="quote-event-types">{types.map(t => <option key={t} value={t} />)}</datalist>
          </Field>
          <Field label="DATE *"><input style={inp} type="date" value={draft.date} onChange={e => patch({ date: e.target.value })} /></Field>
          <Field label="VENUE"><input style={inp} value={draft.venue} onChange={e => patch({ venue: e.target.value })} placeholder="Hall / area" /></Field>
        </div>
      ) : (
        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>BOOKING</label>
          <select value={ev.bookingId} onChange={e => ev.selectBooking(e.target.value)} style={{ ...inp, maxWidth: 480 }} disabled={editing && !!ev.bookingId}>
            <option value="">— Choose a booking —</option>
            {bookings.map(b => <option key={b.id} value={b.id}>{b.customer?.name} · {b.event_type} · {formatDateIST(b.event_date, 'dd-MM-yyyy')}</option>)}
          </select>
          {ev.booking && (
            <div style={{ marginTop: 6, fontSize: 12, color: '#666660' }}>
              {[ev.booking.customer?.name, ev.booking.event_type, formatDateIST(ev.booking.event_date, 'dd-MM-yyyy'), ev.booking.venue].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14 }}>
        <Field label="GUESTS" width={120}>
          <input style={inp} type="number" min={0} inputMode="numeric" value={ev.guests} onChange={e => ev.setGuests(e.target.value)} placeholder="0" />
        </Field>
        <Field label="FOOD TYPE" width={180}>
          <select value={foodType} onChange={e => onFoodType(e.target.value)} style={inp}>
            <option value="">— Select —</option>
            {FOOD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', userSelect: 'none', padding: '8px 0' }}>
          <input type="checkbox" checked={isMultiDay} onChange={e => onMultiDay(e.target.checked)} style={{ accentColor: '#E8750A', width: 15, height: 15 }} />
          <span style={{ fontWeight: 600 }}>Multi-day / multi-meal</span>
        </label>
        <label title={lockItemPrices ? 'Items already have prices' : 'Off = one per-plate price for the whole menu'}
          style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', userSelect: 'none', padding: '8px 0' }}>
          <input type="checkbox" checked={itemPrices} disabled={lockItemPrices} onChange={e => onItemPrices(e.target.checked)} style={{ accentColor: '#E8750A', width: 15, height: 15 }} />
          <span>Price each item</span>
        </label>
      </div>
    </>
  );
};

const Field: React.FC<{ label: string; width?: number; children: React.ReactNode }> = ({ label, width, children }) => (
  <label style={{ display: 'block', minWidth: 0, flex: width ? `0 1 ${width}px` : undefined }}>
    <span style={lbl}>{label}</span>{children}
  </label>
);

const chip: React.CSSProperties = { padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '0.5px solid' };
const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#888880', display: 'block', marginBottom: 4 };
const inp: React.CSSProperties = { width: '100%', border: '1px solid #E5E5E0', borderRadius: 8, padding: '8px 10px', fontSize: 13, boxSizing: 'border-box', background: '#fff' };

export default QuotationEventFields;
