import React from 'react';
import { StageRow } from '../bookings/eventFacts';
import '../../styles/bookings-dialogs.css';

// Inquiry → Paid as a list: what happened at each stage, ✓ when done and "now" on the current one.
const EventStepper: React.FC<{ rows: StageRow[] }> = ({ rows }) => (
  <section className="ev-sec" aria-label="Stage">
    <span className="ev-head">Stage</span>
    <ol className="ev-list" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
      {rows.map(r => (
        <li key={r.stage} className="ev-row" aria-current={r.mark === 'now' ? 'step' : undefined}>
          <span><b>{r.title}</b>{r.sub && <small>{r.sub}</small>}</span>
          <span className={`ev-right ${r.mark}`}>{r.mark === 'done' ? <span aria-label="done">✓</span> : r.mark}</span>
        </li>
      ))}
    </ol>
  </section>
);

export default EventStepper;
