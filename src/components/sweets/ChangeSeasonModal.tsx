import React, { useState } from 'react';
import Modal from '../ui/Modal';
import { SeasonalOccasion } from '../../hooks/useSeasonalOccasions';
import { datesText, seasonTitle } from '../../lib/occasions';
import { useSeasonActions } from './useSeasonActions';
import '../../styles/sweets.css';

interface Props { occasions: SeasonalOccasion[]; sweets: (o: SeasonalOccasion) => number; onClose: () => void }

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Picks the one season whose sweets show on the counter.
const ChangeSeasonModal: React.FC<Props> = ({ occasions, sweets, onClose }) => {
  const actions = useSeasonActions();
  const active = occasions.filter(o => o.is_active);
  const [pick, setPick] = useState<string | null>(active[0]?.id ?? null);
  const chosen = occasions.find(o => o.id === pick) ?? null;
  const same = chosen ? active.length === 1 && chosen.is_active : active.length === 0;

  const save = async () => {
    if (same || (await actions.switchTo(occasions, chosen))) onClose();
  };

  const option = (id: string | null, title: string, sub: string, now: boolean) => (
    <button key={id ?? 'none'} type="button" role="radio" aria-checked={pick === id} className={`sw-radio${pick === id ? ' on' : ''}`} onClick={() => setPick(id)}>
      <span className="dot" aria-hidden="true" />
      <span className="txt"><b>{title}</b><small>{sub}</small></span>
      {now && <b>Now</b>}
    </button>
  );

  return (
    <Modal title="Season on the counter" onClose={onClose} width={420} busy={actions.busy}
      footer={<>
        <button type="button" className="ui-btn" onClick={onClose}>Cancel</button>
        <button type="button" className="ui-btn primary" onClick={save} disabled={actions.busy}>
          {same ? `Keep ${chosen ? chosen.name : 'no season'}` : chosen ? `Start ${chosen.name}` : 'End the season'}
        </button>
      </>}>
      <div className="sw-form">
        <p>Its sweets show on the counter. Bills and pre-bookings between its dates count for it.</p>
        <div className="sw-radios" role="radiogroup" aria-label="Season">
          {occasions.map(o => option(o.id, seasonTitle(o), `${datesText(o) || 'Dates not set'} · ${plural(sweets(o), 'sweet')}`, o.is_active))}
          {option(null, 'No season', 'Only all-year sweets', false)}
        </div>
      </div>
    </Modal>
  );
};

export default ChangeSeasonModal;
