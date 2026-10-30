import React from 'react';
import { ChoiceGroup, pickedOf } from '../../lib/quoteChoices';
import { ChoiceMeta } from '../../hooks/useQuotations';

interface Props {
  group: ChoiceGroup;
  showPrices: boolean;
  rows: React.ReactNode[];
  onMeta: (patch: Partial<ChoiceMeta>) => void;
  onUngroup: () => void;
  onAddAlternative: () => void;
}

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;

// "Customer chooses 1 of 2": the dishes joined by "or", a Picked tick each, and how it affects the price.
const QuotationChoiceGroup: React.FC<Props> = ({ group, showPrices, rows, onMeta, onUngroup, onAddAlternative }) => {
  const { meta, items } = group;
  const n = Math.min(Math.max(1, meta.pick), items.length);
  const picked = pickedOf(group).length;
  // Once decided, the picked dishes set the price; until then cheapest..dearest picks.
  const prices = (picked === n ? pickedOf(group) : items).map(i => Number(i.amount) || 0).sort((a, b) => a - b);
  const lo = prices.slice(0, n).reduce((s, x) => s + x, 0);
  const hi = prices.slice(prices.length - n).reduce((s, x) => s + x, 0);
  const priced = showPrices && !meta.included && hi > 0;

  return (
    <div style={{ margin: '6px 8px', border: '1.5px solid #E8750A', borderRadius: 10, background: '#FFFCF8' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '8px 10px', borderBottom: '0.5px solid #F5E1C8' }}>
        <b style={{ fontSize: 13, color: '#A84F00' }}>Customer chooses</b>
        {items.length > 2 ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', border: '0.5px solid #D0D0CC', borderRadius: 6, overflow: 'hidden', background: '#fff' }}>
            <button type="button" aria-label="Choose one fewer" onClick={() => onMeta({ pick: Math.max(1, n - 1) })} style={step}>−</button>
            <b style={{ minWidth: 22, textAlign: 'center', fontSize: 13 }}>{n}</b>
            <button type="button" aria-label="Choose one more" onClick={() => onMeta({ pick: Math.min(items.length - 1, n + 1) })} style={step}>+</button>
          </span>
        ) : <b style={{ fontSize: 13, color: '#A84F00' }}>{n}</b>}
        <b style={{ fontSize: 13, color: '#A84F00' }}>of {items.length}</b>
        <span style={{ fontSize: 11.5, color: picked === n ? '#2F5A0E' : '#888880' }}>
          {picked === n ? '· decided' : picked ? `· ${picked} picked` : '· tick Picked when they decide'}
        </span>
        <button type="button" onClick={onUngroup} title="Keep all these dishes, no choice" style={{ marginLeft: 'auto', fontSize: 11.5, color: '#888880', background: 'none', border: 'none', cursor: 'pointer' }}>Remove choice</button>
      </div>

      {rows.map((r, i) => (
        <React.Fragment key={i}>
          {i > 0 && <div aria-hidden="true" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', fontSize: 10.5, fontWeight: 700, color: '#C9873E', letterSpacing: 1 }}>
            <span style={{ flex: 1, height: 1, background: '#F2D9B8' }} />OR<span style={{ flex: 1, height: 1, background: '#F2D9B8' }} /></div>}
          {r}
        </React.Fragment>
      ))}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '7px 10px', fontSize: 11.5, color: '#666', background: '#FFF6EA', borderTop: '0.5px solid #F5E1C8', borderRadius: '0 0 10px 10px' }}>
        <button type="button" onClick={onAddAlternative} style={{ fontSize: 12, fontWeight: 600, color: '#A84F00', background: '#fff', border: '1px dashed #E8A867', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>+ Add another alternative</button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>On the quote as
          <input value={meta.label} onChange={e => onMeta({ label: e.target.value })} aria-label="Name on the quote"
            style={{ width: 120, border: 'none', borderBottom: '1px dashed #E8A867', background: 'transparent', fontSize: 12, fontWeight: 600, padding: '1px 2px' }} />
        </label>
        {showPrices && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!meta.included} onChange={e => onMeta({ included: e.target.checked })} style={{ accentColor: '#E8750A' }} />
            Same price whatever they pick
          </label>
        )}
        <span style={{ marginLeft: 'auto' }}>
          {priced ? (lo === hi ? `Adds ${rupees(lo)} / plate` : `Adds ${rupees(lo)} – ${rupees(hi)} / plate`) : 'No change to the price'}
        </span>
      </div>
    </div>
  );
};

const step: React.CSSProperties = { width: 28, height: 28, border: 'none', background: '#F9F8F5', cursor: 'pointer', fontSize: 14 };

export default QuotationChoiceGroup;
