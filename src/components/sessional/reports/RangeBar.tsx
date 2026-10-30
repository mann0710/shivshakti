import React from 'react';
import { Preset, PRESETS, Range, presetRange } from '../../../lib/reports';
import { SeasonalOccasion } from '../../../hooks/useSeasonalOccasions';
import { inp, NAVY } from '../../ui/styles';

interface Props {
  preset: Preset;
  range: Range;
  occasionId: string;
  occasions: SeasonalOccasion[];
  disabled?: boolean; // e.g. the Dues report is always "as of today"
  onChange: (preset: Preset, range: Range) => void;
  onOccasion: (id: string) => void;
}

// Quick periods, exact from/to dates and an occasion filter.
const RangeBar: React.FC<Props> = ({ preset, range, occasionId, occasions, disabled, onChange, onOccasion }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 12, opacity: disabled ? 0.55 : 1 }}>
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {PRESETS.filter(([p]) => p !== 'custom').map(([p, label]) => (
        <button key={p} type="button" disabled={disabled} onClick={() => onChange(p, presetRange(p))} aria-pressed={preset === p}
          style={{ padding: '6px 11px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: `0.5px solid ${preset === p ? NAVY : '#D0D0CC'}`,
            background: preset === p ? NAVY : '#fff', color: preset === p ? '#fff' : '#444', fontWeight: preset === p ? 600 : 400 }}>
          {label}
        </button>
      ))}
    </div>
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
      <input type="date" aria-label="From" style={{ ...inp, width: 'auto', padding: '5px 8px' }} value={range.from} max={range.to} disabled={disabled}
        onChange={e => e.target.value && onChange('custom', { from: e.target.value, to: range.to })} />
      <span>to</span>
      <input type="date" aria-label="To" style={{ ...inp, width: 'auto', padding: '5px 8px' }} value={range.to} min={range.from} disabled={disabled}
        onChange={e => e.target.value && onChange('custom', { from: range.from, to: e.target.value })} />
    </div>
    <select aria-label="Occasion" style={{ ...inp, width: 'auto', padding: '6px 8px' }} value={occasionId} onChange={e => onOccasion(e.target.value)}>
      <option value="">All occasions</option>
      {occasions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
    </select>
  </div>
);

export default RangeBar;
