import React from 'react';
import PickupDates, { PAST_PRESETS } from './PickupDates';
import { BillFilter, BillPay, BillType, NO_FILTER } from '../../lib/billList';
import { SeasonalOccasion } from '../../hooks/useSeasonalOccasions';
import { inp } from '../ui/styles';

interface Props { value: BillFilter; onChange: (f: BillFilter) => void; occasions: SeasonalOccasion[]; unpaid: number }

const TYPES: [BillType, string][] = [['all', 'Bills and pre-bookings'], ['bill', 'Counter bills'], ['booking', 'Pre-bookings']];
const MODES: [BillFilter['mode'], string][] = [['all', 'Any payment'], ['cash', 'Cash'], ['upi', 'UPI'], ['mixed', 'Cash + UPI']];
const sel = { ...inp, width: 'auto', minHeight: 44, background: '#fff' };

// Date, occasion, kind, paid or not, payment mode and search for the Bills list.
const BillFilters: React.FC<Props> = ({ value: f, onChange, occasions, unpaid }) => {
  const set = (patch: Partial<BillFilter>) => onChange({ ...f, ...patch });
  const pays: [BillPay, string][] = [['all', 'Paid and unpaid'], ['unpaid', `Unpaid (${unpaid})`], ['paid', 'Paid'], ['cancelled', 'Cancelled']];
  const dirty = JSON.stringify(f) !== JSON.stringify(NO_FILTER);
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center' }}>
      <PickupDates label="Bill dates" presets={PAST_PRESETS} value={f.span} onChange={span => set({ span })} />
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
      {dirty && <button type="button" className="ui-btn" onClick={() => onChange(NO_FILTER)}>Clear filters</button>}
    </div>
  );
};

export default BillFilters;
