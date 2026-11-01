import React, { useState } from 'react';
import { ALL_DATES, DateSpan, Preset, presetSpan } from '../../lib/preorders';
import { todayIST } from '../../lib/ist';
import { inp } from '../ui/styles';

const PRESETS: [Preset, string][] = [['all', 'All dates'], ['today', 'Today'], ['tomorrow', 'Tomorrow'], ['next3', 'Next 3 days'], ['week', 'Next 7 days'], ['custom', 'Pick dates…']];

// Pickup dates for the list, the kitchen prep list and both PDFs: a quick choice or a from–to range.
const PickupDates: React.FC<{ value: DateSpan; onChange: (s: DateSpan) => void }> = ({ value, onChange }) => {
  const [preset, setPreset] = useState<Preset>('all');
  const pick = (k: Preset) => {
    setPreset(k);
    onChange(k === 'custom' ? (value.from || value.to ? value : presetSpan('next3', todayIST())) : k === 'all' ? ALL_DATES : presetSpan(k, todayIST()));
  };
  const date = { ...inp, width: 'auto', minHeight: 44 };
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <select style={{ ...date, background: '#fff' }} aria-label="Pickup dates" value={preset} onChange={e => pick(e.target.value as Preset)}>
        {PRESETS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
      </select>
      {preset === 'custom' && <>
        <input type="date" style={date} aria-label="From pickup date" value={value.from} max={value.to || undefined} onChange={e => onChange({ ...value, from: e.target.value })} />
        <span aria-hidden="true">–</span>
        <input type="date" style={date} aria-label="To pickup date" value={value.to} min={value.from || undefined} onChange={e => onChange({ ...value, to: e.target.value })} />
      </>}
    </div>
  );
};

export default PickupDates;
