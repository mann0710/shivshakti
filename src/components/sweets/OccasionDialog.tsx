import React, { useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import { SeasonalOccasion, useSetSeason, useUpdateSeasonalOccasion } from '../../hooks/useSeasonalOccasions';
import { checkDates } from '../../lib/occasions';
import '../../styles/sweets.css';

interface Props { o: SeasonalOccasion; onClose: () => void; onDelete: () => void }

const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Could not save');

// Name, season dates and whether its sweets are on the counter.
const OccasionDialog: React.FC<Props> = ({ o, onClose, onDelete }) => {
  const update = useUpdateSeasonalOccasion();
  const setSeason = useSetSeason();
  const [name, setName] = useState(o.name);
  const [from, setFrom] = useState(o.start_date ?? '');
  const [to, setTo] = useState(o.end_date ?? '');
  const [on, setOn] = useState(o.is_active);
  const [tried, setTried] = useState(false);
  const busy = update.isPending || setSeason.isPending;
  const dirty = name !== o.name || from !== (o.start_date ?? '') || to !== (o.end_date ?? '') || on !== o.is_active;
  const dates = checkDates(from, to);
  const nameError = tried && !name.trim() ? 'Give it a name' : '';
  const dateError = tried && !dates.ok ? dates.error : '';
  const label = name.trim() || o.name;

  const save = async () => {
    setTried(true);
    if (!name.trim() || !dates.ok) return;
    try {
      await update.mutateAsync({ id: o.id, name: name.trim(), start_date: from || null, end_date: to || null });
      if (on !== o.is_active) await setSeason.mutateAsync(on ? { on: [o.id] } : { off: [o.id] });
      toast.success(`${name.trim()} saved`);
      onClose();
    } catch (e) { toast.error(errorText(e)); }
  };

  return (
    <Modal title={label} onClose={onClose} width={420} dirty={dirty} busy={busy}
      footer={<>
        <button type="button" className="sw-textbtn danger" onClick={onDelete} disabled={busy}>Delete…</button>
        <button type="button" className="ui-btn" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className="ui-btn primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </>}>
      <form className="sw-form" onSubmit={e => { e.preventDefault(); save(); }}>
        <p>Bills and pre-bookings between these dates count for {label}.</p>
        <label className={`sw-field${nameError ? ' bad' : ''}`}>Name
          <input value={name} onChange={e => setName(e.target.value)} />
          {nameError && <small className="bad">{nameError}</small>}
        </label>
        <div className="sw-pair">
          <label className={`sw-field${!from || dateError ? ' bad' : ''}`}>From
            <input type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} />
            {dateError ? <small className="bad">{dateError}</small> : !from && <small className="bad">Needed so bills and pre-bookings count for it</small>}
          </label>
          <label className="sw-field">To
            <input type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} />
            <small>The festival day</small>
          </label>
        </div>
        <label className="sw-check">
          <input type="checkbox" checked={on} onChange={e => setOn(e.target.checked)} />
          Show its sweets on the counter
        </label>
      </form>
    </Modal>
  );
};

export default OccasionDialog;
