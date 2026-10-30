import React from 'react';
import { ChoiceGroup } from '../../lib/quoteChoices';
import { ChoiceMeta } from '../../hooks/useQuotations';

interface Props {
  group: ChoiceGroup;
  showPrices: boolean;
  onMeta: (patch: Partial<ChoiceMeta>) => void;
  onUngroup: () => void;
  children: React.ReactNode;
}

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;

// "Customer chooses N of M" block around its dishes, with how it affects the plate price.
const QuotationChoiceGroup: React.FC<Props> = ({ group, showPrices, onMeta, onUngroup, children }) => {
  const { meta, items } = group;
  const n = Math.min(Math.max(1, meta.pick), items.length);
  const prices = items.map(i => Number(i.amount) || 0).sort((a, b) => a - b);
  const lo = prices.slice(0, n).reduce((s, x) => s + x, 0);
  const hi = prices.slice(prices.length - n).reduce((s, x) => s + x, 0);
  const priced = showPrices && !meta.included && hi > 0;

  return (
    <div style={{ margin: '6px 8px', border: '1.5px solid #E8750A', borderRadius: 8, background: '#FFFCF8' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '6px 8px', borderBottom: '0.5px solid #F5E1C8' }}>
        <input value={meta.label} onChange={e => onMeta({ label: e.target.value })} aria-label="Group name"
          style={{ flex: '1 1 120px', minWidth: 0, border: 'none', borderBottom: '1px dashed #E8A867', background: 'transparent', fontSize: 12, fontWeight: 700, padding: '2px 0' }} />
        <span style={{ fontSize: 11.5, color: '#A84F00', fontWeight: 600 }}>Choose</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', border: '0.5px solid #D0D0CC', borderRadius: 6, overflow: 'hidden', background: '#fff' }}>
          <button type="button" aria-label="Choose one fewer" onClick={() => onMeta({ pick: Math.max(1, n - 1) })} style={step}>−</button>
          <b style={{ minWidth: 22, textAlign: 'center', fontSize: 12 }}>{n}</b>
          <button type="button" aria-label="Choose one more" onClick={() => onMeta({ pick: Math.min(items.length, n + 1) })} style={step}>+</button>
        </span>
        <span style={{ fontSize: 11.5, color: '#A84F00', fontWeight: 600 }}>of {items.length}</span>
        <button type="button" onClick={onUngroup} style={{ marginLeft: 'auto', fontSize: 11, color: '#888880', background: 'none', border: 'none', cursor: 'pointer' }}>Ungroup</button>
      </div>
      {children}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '5px 8px', fontSize: 11, color: '#666', background: '#FFF6EA', borderTop: '0.5px solid #F5E1C8' }}>
        {showPrices && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!meta.included} onChange={e => onMeta({ included: e.target.checked })} style={{ accentColor: '#E8750A' }} />
            Included in the plate price
          </label>
        )}
        <span style={{ marginLeft: 'auto' }}>
          {priced ? (lo === hi ? `Adds ${rupees(lo)} / plate` : `Adds ${rupees(lo)} – ${rupees(hi)} / plate`) : 'No change to the plate price'}
        </span>
      </div>
    </div>
  );
};

const step: React.CSSProperties = { width: 26, height: 26, border: 'none', background: '#F9F8F5', cursor: 'pointer', fontSize: 14 };

export default QuotationChoiceGroup;
