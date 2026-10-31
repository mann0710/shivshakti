import React from 'react';
import { SeasonalOccasion } from '../../hooks/useSeasonalOccasions';
import { SeasonalItem } from '../../hooks/useSeasonalItems';
import { SeasonCount, datesText, inDates, occasionState } from '../../lib/occasions';
import SweetsMenu from './SweetsMenu';
import '../../styles/sweets.css';

interface Props {
  o: SeasonalOccasion;
  sweets: SeasonalItem[];
  count: SeasonCount;
  today: string;
  busy: boolean;
  onEdit: () => void;
  onSee: () => void;
  onStart: () => void;
  onEnd: () => void;
  onDelete: () => void;
}

// One festival: its dates, sweets, bills and pre-bookings, and the switch that puts its sweets on the counter.
const OccasionCard: React.FC<Props> = ({ o, sweets, count, today, busy, onEdit, onSee, onStart, onEnd, onDelete }) => {
  const n = sweets.length;
  const stat = (label: string, value: string | number) => <div className="sw-stat" key={label}><span>{label}</span><b>{value}</b></div>;
  return (
    <article className={`sw-occ${o.is_active ? ' on' : ''}`} aria-label={o.name}>
      <div className="sw-occ-top">
        <div>
          <h2>{o.name}</h2>
          <span className={`sw-state${o.is_active && inDates(o, today) ? ' on' : ''}`}>{occasionState(o, today)}</span>
        </div>
        <SweetsMenu label={`More for ${o.name}`} items={[
          { label: 'Edit dates', onClick: onEdit, strong: true },
          { label: 'Start season now', onClick: onStart, disabled: o.is_active || busy },
          { label: 'End season', onClick: onEnd, disabled: !o.is_active || busy },
          { label: 'Delete…', onClick: onDelete, danger: true, sep: true },
        ]} />
      </div>
      <div className="sw-stats">
        {stat('Dates', datesText(o) || 'Not set')}
        {stat('Sweets', n)}
        {stat('Bills', count.bills)}
        {stat('Pre-bookings', count.bookings)}
      </div>
      <span className="sw-occ-names">{n ? sweets.map(s => s.name).join(', ') : 'No sweets yet. Add them on Sweet items and pick this occasion.'}</span>
      <div className="sw-occ-acts">
        {o.is_active
          ? <button type="button" className="ui-btn grow" onClick={onEnd} disabled={busy}>Season over — hide its sweets</button>
          : <button type="button" className="ui-btn primary grow" onClick={onStart} disabled={busy}>Start season{n ? ` — show its ${n} sweet${n === 1 ? '' : 's'}` : ''}</button>}
        {n > 0 && <button type="button" className="ui-btn" onClick={onSee}>See sweets</button>}
      </div>
    </article>
  );
};

export default OccasionCard;
