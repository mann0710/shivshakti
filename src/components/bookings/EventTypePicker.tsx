import React, { useState } from 'react';
import { Chips, inputClass } from './FormBits';

interface Props {
  types: string[];          // saved event types, most used first
  value: string;            // the event type in use
  custom: boolean;          // typing a name that is not in the list
  onPick: (type: string) => void;
  onCustom: (name: string) => void;
  error?: string;
}

const SHOWN = 5;
const OTHER = '__other';

// Event chips for the common types, More… for the rest or a new name.
const EventTypePicker: React.FC<Props> = ({ types, value, custom, onPick, onCustom, error }) => {
  const [more, setMore] = useState(false);
  const top = types.slice(0, SHOWN);
  const chips = !custom && value && !top.includes(value) ? [...top, value] : top;
  const rest = types.filter(t => !chips.includes(t));
  const extra = (
    <button type="button" className="bkf-chip" aria-pressed={custom || more} aria-expanded={more || custom} onClick={() => setMore(m => !m)}>More…</button>
  );
  return (
    <>
      <Chips label="Event" options={chips} value={custom ? '' : value} onPick={t => { setMore(false); onPick(t); }} extra={extra} full error={custom ? undefined : error} />
      {(more || custom) && (
        <div className="bkf-grid bkf-full">
          <label className="bkf-field">
            <span className="bkf-label">Other event</span>
            <select className="bkf-input" value={custom ? OTHER : ''} onChange={e => { if (e.target.value === OTHER) onCustom(''); else if (e.target.value) { setMore(false); onPick(e.target.value); } }}>
              <option value="">Pick one…</option>
              {rest.map(t => <option key={t} value={t}>{t}</option>)}
              <option value={OTHER}>Something else (type it)</option>
            </select>
          </label>
          {custom && (
            <label className="bkf-field">
              <span className="bkf-label">Event name</span>
              <input className={inputClass(error)} value={value} placeholder="e.g. Satyanarayan Katha" onChange={e => onCustom(e.target.value)} />
              {error && <span className="bkf-hint bad" role="alert">{error}</span>}
            </label>
          )}
        </div>
      )}
    </>
  );
};

export default EventTypePicker;
