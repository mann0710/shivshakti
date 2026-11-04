import React, { useEffect, useState } from 'react';
import { ALL_DATES, DateSpan, Preset, presetSpan } from '../../lib/preorders';
import { todayIST } from '../../lib/ist';
import { inp } from '../ui/styles';

export type Presets = [Preset, string][];
const PRESETS: Presets = [['all', 'All dates'], ['today', 'Today'], ['tomorrow', 'Tomorrow'], ['next3', 'Next 3 days'], ['week', 'Next 7 days'], ['custom', 'Pick dates…']];
export const PAST_PRESETS: Presets = [['all', 'All dates'], ['today', 'Today'], ['yesterday', 'Yesterday'], ['last7', 'Last 7 days'], ['month', 'This month'], ['custom', 'Pick dates…']];

// Pickup dates as a quick choice or a from–to range; `label` names it when a page has two, `presets` swaps in past ranges.
const PickupDates: React.FC<{ value: DateSpan; onChange: (s: DateSpan) => void; label?: string; presets?: Presets }> = ({ value, onChange, label = 'Pickup dates', presets = PRESETS }) => {
  const [preset, setPreset] = useState<Preset>('all');
  // Cleared from outside (e.g. Clear filters): back to All dates.
  useEffect(() => { if (!value.from && !value.to) setPreset('all'); }, [value.from, value.to]);
  const pick = (k: Preset) => {
    setPreset(k);
    onChange(k === 'custom' ? (value.from || value.to ? value : presetSpan(presets === PRESETS ? 'next3' : 'last7', todayIST())) : k === 'all' ? ALL_DATES : presetSpan(k, todayIST()));
  };
  const date = { ...inp, width: 'auto', minHeight: 44 };
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <select style={{ ...date, background: '#fff' }} aria-label={label} value={preset} onChange={e => pick(e.target.value as Preset)}>
        {presets.map(([k, name]) => <option key={k} value={k}>{name}</option>)}
      </select>
      {preset === 'custom' && <>
        <input type="date" style={date} aria-label={`${label} from`} value={value.from} max={value.to || undefined} onChange={e => onChange({ ...value, from: e.target.value })} />
        <span aria-hidden="true">–</span>
        <input type="date" style={date} aria-label={`${label} to`} value={value.to} min={value.from || undefined} onChange={e => onChange({ ...value, to: e.target.value })} />
      </>}
    </div>
  );
};

export default PickupDates;
