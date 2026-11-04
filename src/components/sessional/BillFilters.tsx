import React from 'react';
import PickupDates, { PAST_PRESETS } from './PickupDates';
import { BillFilter, BillPay, BillType, NO_FILTER, Stage, STAGE_LABEL } from '../../lib/billList';
import { SeasonalOccasion } from '../../hooks/useSeasonalOccasions';
import { inp, STAGE_COLOR } from '../ui/styles';

interface Props {
  value: BillFilter;
  onChange: (f: BillFilter) => void;
  occasions: SeasonalOccasion[];
  counts: Record<'all' | Stage, number>;
  unpaid: number;
}

const STAGES: ('all' | Stage)[] = ['all', 'booked', 'packed', 'given', 'cancelled'];
const TYPES: [BillType, string][] = [['all', 'Bills and pre-bookings'], ['bill', 'Counter bills'], ['booking', 'Pre-bookings']];
const MODES: [BillFilter['mode'], string][] = [['all', 'Any payment'], ['cash', 'Cash'], ['upi', 'UPI'], ['mixed', 'Cash + UPI']];
const sel = { ...inp, width: 'auto', minHeight: 44, background: '#fff' };

// Stage chips (with counts), then date, occasion, kind, paid or not, payment mode and search.
const BillFilters: React.FC<Props> = ({ value: f, onChange, occasions, counts, unpaid }) => {
  const set = (patch: Partial<BillFilter>) => onChange({ ...f, ...patch });
  const pays: [BillPay, string][] = [['all', 'Paid and unpaid'], ['unpaid', `Unpaid (${unpaid})`], ['paid', 'Paid']];
  const dirty = JSON.stringify(f) !== JSON.stringify(NO_FILTER);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
      <div className="stage-chips" role="group" aria-label="Stage">
        {STAGES.map(k => {
          const c = k === 'all' ? null : STAGE_COLOR[k];
          const on = f.stage === k;
          return (
            <button key={k} type="button" aria-pressed={on} onClick={() => set({ stage: k })} className={`stage-chip${on ? ' on' : ''}`}
              style={c ? { '--c': c.color, '--bg': c.bg } as React.CSSProperties : undefined}>
              {c && <i aria-hidden="true" />}{k === 'all' ? 'All' : STAGE_LABEL[k]} <b>{counts[k]}</b>
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <PickupDates label="Bill dates" presets={PAST_PRESETS} preset={f.preset} value={f.span} onChange={(span, preset) => set({ span, preset })} />
        <select style={sel} aria-label="Occasion" value={f.occasion} onChange={e => set({ occasion: e.target.value })}>
          <option value="">All occasions</option>
          {occasions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <select style={sel} aria-label="Kind" value={f.type} onChange={e => set({ type: e.target.value as BillType })}>
          {TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select style={sel} aria-label="Paid or unpaid" value={f.pay} onChange={e => set({ pay: e.target.value as BillPay })}>
          {pays.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select style={sel} aria-label="Payment mode" value={f.mode} onChange={e => set({ mode: e.target.value as BillFilter['mode'] })}>
          {MODES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <input style={{ ...inp, flex: '1 1 200px', width: 'auto', minHeight: 44 }} value={f.q} onChange={e => set({ q: e.target.value })} placeholder="Search name, mobile or bill #" aria-label="Search bills" />
        {dirty && <button type="button" className="ui-btn" onClick={() => onChange(NO_FILTER)}>Reset filters</button>}
      </div>
    </div>
  );
};

export default BillFilters;
