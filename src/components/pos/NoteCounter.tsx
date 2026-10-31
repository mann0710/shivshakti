import React from 'react';
import { NOTES, NoteCounts, NoteKey, countedOf } from '../../lib/dayClose';
import { inr } from '../../lib/money';
import { inp } from '../ui/styles';

interface Props {
  counts: NoteCounts;
  onChange: (counts: NoteCounts) => void;
}

const num = (v: string) => Math.max(0, Math.floor(Number(v.replace(/\D/g, '')) || 0));

// Count the drawer note by note; coins go in as a rupee amount.
const NoteCounter: React.FC<Props> = ({ counts, onChange }) => {
  const set = (k: NoteKey, v: string) => onChange({ ...counts, [k]: num(v) || undefined });
  const field = (k: NoteKey, label: string) => (
    <label key={k}>
      <span style={{ minWidth: 52 }}>{label}</span>
      <input style={{ ...inp, width: 64, minHeight: 44, textAlign: 'center' }} inputMode="numeric" value={counts[k] ?? ''} placeholder="0" aria-label={k === 'coins' ? 'Coins in rupees' : `Number of ₹${k} notes`}
        onChange={e => set(k, e.target.value)} onFocus={e => e.target.select()} />
      {k !== 'coins' && <span style={{ color: '#5A5A55', fontWeight: 400, fontSize: 12 }}>{inr(Number(k) * (counts[k] ?? 0))}</span>}
    </label>
  );
  return (
    <div>
      <div className="dc-notes">
        {NOTES.map(n => field(n, `₹${n} ×`))}
        {field('coins', 'Coins ₹')}
      </div>
      <div className="dc-row total" style={{ marginTop: 8 }}><span>Counted</span><span>{inr(countedOf(counts))}</span></div>
    </div>
  );
};

export default NoteCounter;
