import React, { useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import { SeasonalItem, adjustRate, legacySize } from '../../lib/itemCatalog';
import { useBulkUpdateRates, BulkPriceChange } from '../../hooks/useSeasonalItems';
import { rateLabel, formatSize } from '../../lib/units';
import { inr } from '../../lib/money';
import { inp, lbl, btnPrimary, btnGhost, segBtn, segWrap, fieldWrap, th, td } from '../ui/styles';

interface Props { items: SeasonalItem[]; onClose: () => void }

const ROUNDING = [1, 5, 10, 20, 50];

// Raise or cut prices of many items at once (e.g. +10% before Diwali), with a preview.
const BulkPriceModal: React.FC<Props> = ({ items, onClose }) => {
  const bulk = useBulkUpdateRates();
  const [mode, setMode] = useState<BulkPriceChange['mode']>('percent');
  const [value, setValue] = useState('10');
  const [roundTo, setRoundTo] = useState(10);
  const change: BulkPriceChange = { mode, value: Number(value) || 0, roundTo };

  // Old one-row-per-pack items show their pack price; rate-based items show the rate.
  const before = (i: SeasonalItem) => (legacySize(i) ? i.price : i.rate);
  const label = (i: SeasonalItem, n: number) => {
    const size = legacySize(i);
    return size ? `${inr(n)} / ${formatSize(size, i.unit)}` : rateLabel(n, i.unit);
  };

  const apply = async () => {
    if (!change.value) { toast.error('Enter a change'); return; }
    try {
      const n = await bulk.mutateAsync({ items, change });
      toast.success(`Updated ${n} item${n === 1 ? '' : 's'}`);
      onClose();
    } catch (e: any) { toast.error(e.message || 'Update failed'); }
  };

  return (
    <Modal title={`Change prices of ${items.length} item${items.length === 1 ? '' : 's'}`} onClose={onClose} width={560}
      footer={<>
        <button style={btnGhost} onClick={onClose}>Cancel</button>
        <button style={btnPrimary} onClick={apply} disabled={bulk.isPending}>{bulk.isPending ? 'Updating…' : 'Apply new prices'}</button>
      </>}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14 }}>
        <div style={fieldWrap}>
          <span style={lbl}>Change by</span>
          <div style={segWrap}>
            <button type="button" style={segBtn(mode === 'percent')} onClick={() => setMode('percent')}>%</button>
            <button type="button" style={segBtn(mode === 'amount')} onClick={() => setMode('amount')}>₹</button>
          </div>
        </div>
        <label style={fieldWrap}>
          <span style={lbl}>Amount (use − to reduce)</span>
          <input style={{ ...inp, width: 120 }} inputMode="decimal" value={value} onChange={e => setValue(e.target.value)} />
        </label>
        <label style={fieldWrap}>
          <span style={lbl}>Round to nearest</span>
          <select style={{ ...inp, width: 110 }} value={roundTo} onChange={e => setRoundTo(Number(e.target.value))}>
            {ROUNDING.map(r => <option key={r} value={r}>₹{r}</option>)}
          </select>
        </label>
      </div>
      <div style={{ maxHeight: 320, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ background: '#F5F5F2' }}><th style={th}>Item</th><th style={th}>Now</th><th style={th}>New</th></tr></thead>
          <tbody>
            {items.map(i => (
              <tr key={i.id} style={{ borderBottom: '0.5px solid #F0F0EC' }}>
                <td style={td}>{i.name}</td>
                <td style={{ ...td, color: '#6B6B66' }}>{label(i, before(i))}</td>
                <td style={{ ...td, fontWeight: 600 }}>{label(i, adjustRate(before(i), change.mode, change.value, change.roundTo))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 12, color: '#6B6B66', marginTop: 8 }}>Pack prices follow automatically. Manual pack prices move by the same rule.</div>
    </Modal>
  );
};

export default BulkPriceModal;
