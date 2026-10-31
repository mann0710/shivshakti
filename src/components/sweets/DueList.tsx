import React from 'react';
import { SeasonalPreorder } from '../../hooks/useSeasonalPreorders';
import { usePreorderActions } from '../../hooks/usePreorderActions';
import { FULFILLMENT_LABEL, fulfillmentOf } from '../../lib/preorders';
import { linesText, looksLikeTest } from '../../lib/sweetsToday';
import { dayName } from '../../lib/occasions';
import { inr } from '../../lib/money';
import SweetsMenu from './SweetsMenu';
import '../../styles/sweets.css';

interface Props { list: SeasonalPreorder[]; today: string; onAll: () => void }

// Open pre-bookings, soonest first: hand over is the main step, the rest sits under ⋯.
const DueList: React.FC<Props> = ({ list, today, onAll }) => {
  const act = usePreorderActions();

  const row = (p: SeasonalPreorder) => {
    const when = p.delivery_date ? dayName(p.delivery_date) : 'No date';
    const late = !!p.delivery_date && p.delivery_date < today;
    const what = [p.status === 'ready' ? 'Packed' : '', linesText(p.items), FULFILLMENT_LABEL[fulfillmentOf(p)].toLowerCase()].filter(Boolean).join(' · ');
    const noAdvance = p.advance_paid <= 0;
    const test = looksLikeTest(p.customer_name);
    return (
      <div key={p.id} className="sw-due">
        <div className="sw-due-top">
          <span className={`sw-when${late ? ' late' : ''}`}>{when}</span>
          <span className="sw-who">
            <b>{p.customer_name}<span className="sw-phone"> · {when}</span>{test && <small className="sw-desk"> · looks like a test entry</small>}</b>
            <span>{test && <span className="sw-phone sw-bad">Looks like a test entry · </span>}{what}</span>
          </span>
          <span className="sw-amt">
            <b>{inr(p.total_amount)}</b>
            {noAdvance ? <><span className="bad sw-desk">no advance</span><span className="sw-chip-bad sw-phone">No advance</span></>
              : <span>{inr(p.advance_paid)} paid</span>}
          </span>
        </div>
        <div className="sw-due-acts">
          <button type="button" className="ui-btn sw-soft" onClick={() => act.startHandover(p)}>Hand over</button>
          <SweetsMenu label={`More for ${p.customer_name}`} items={[
            { label: p.status === 'ready' ? 'Not packed yet' : 'Mark packed', onClick: () => act.togglePacked(p), strong: true },
            { label: noAdvance ? 'Ask for advance' : 'Send a reminder', onClick: () => (noAdvance ? act.askAdvance(p) : act.remind(p)), disabled: !p.phone, hint: p.phone ? 'WhatsApp' : 'no mobile' },
            { label: 'Cancel booking…', onClick: () => act.changeStatus(p, 'cancelled'), danger: true, sep: true },
          ]} />
        </div>
      </div>
    );
  };

  return (
    <section className="sw-card" aria-label="Pre-bookings due">
      <div className="sw-card-head">
        <h2>Pre-bookings due</h2>
        <button type="button" className="sw-link" onClick={onAll}>All pre-bookings →</button>
      </div>
      {list.length ? list.map(row) : <div className="sw-empty">No open pre-bookings.</div>}
      {act.ui}
    </section>
  );
};

export default DueList;
