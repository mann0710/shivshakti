import React, { useState } from 'react';
import Modal from '../ui/Modal';
import { SeasonalItem } from '../../lib/itemCatalog';
import { Pack, parseSize, sizeForAmount, loosePrice, formatSize, rateLabel, UNITS } from '../../lib/units';
import { inr } from '../../lib/money';
import { btnPrimary, btnGhost, inp, lbl, segBtn, segWrap, NAVY } from '../ui/styles';

interface Props {
  item: SeasonalItem;
  packs: Pack[];
  onAdd: (size: number, price: number, qty: number) => void;
  onClose: () => void;
}

type By = 'weight' | 'amount';

// Pick a pack with a quantity, or sell a loose weight / rupee amount at the per-kg rate.
const PackPicker: React.FC<Props> = ({ item, packs, onAdd, onClose }) => {
  const [qty, setQty] = useState(1);
  const [by, setBy] = useState<By>('weight');
  const [text, setText] = useState('');
  const unit = UNITS[item.unit];
  const pieces = item.unit === 'pc';

  const size = by === 'weight' ? parseSize(text, item.unit) : sizeForAmount(item.rate, Number(text) || 0, item.unit);
  const price = size ? (by === 'amount' ? Number(text) : loosePrice(item.rate, size, item.unit)) : 0;
  const valid = !!size && size > 0 && price > 0;

  const addCustom = () => { if (valid) { onAdd(size!, price, 1); onClose(); } };

  return (
    <Modal title={item.name} onClose={onClose} width={420}>
      <div style={{ fontSize: 12, color: '#888880', marginBottom: 12 }}>{rateLabel(item.rate, item.unit)}</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={lbl}>Quantity</span>
        <div className="pos-qty">
          <button type="button" aria-label="Less" onClick={() => setQty(q => Math.max(1, q - 1))}>−</button>
          <span>{qty}</span>
          <button type="button" aria-label="More" onClick={() => setQty(q => q + 1)}>+</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8, marginBottom: 18 }}>
        {packs.map(p => (
          <button key={p.size} type="button" className="pos-pack" style={{ minHeight: 54, fontSize: 13 }}
            onClick={() => { onAdd(p.size, p.price, qty); onClose(); }}>
            <span>{p.label}</span>
            <span className="p">{inr(p.price)}{qty > 1 ? ` × ${qty}` : ''}</span>
          </button>
        ))}
      </div>

      <div style={{ borderTop: '0.5px solid #E5E5E0', paddingTop: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{pieces ? 'Other count' : 'Loose / custom'}</div>
        {!pieces && (
          <div style={{ ...segWrap, marginBottom: 8 }}>
            <button type="button" style={segBtn(by === 'weight')} onClick={() => { setBy('weight'); setText(''); }}>By weight</button>
            <button type="button" style={segBtn(by === 'amount')} onClick={() => { setBy('amount'); setText(''); }}>By amount ₹</button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <input style={inp} autoFocus inputMode="decimal" value={text}
            placeholder={pieces ? 'e.g. 8' : by === 'weight' ? `e.g. 300 ${unit.base} or 1.25 ${unit.label}` : 'e.g. 100'}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCustom()} />
          <button type="button" style={{ ...btnPrimary, opacity: valid ? 1 : 0.5 }} disabled={!valid} onClick={addCustom}>Add</button>
        </div>
        <div style={{ fontSize: 12, marginTop: 6, minHeight: 18, color: valid ? NAVY : '#AAAAAA' }}>
          {valid ? `${formatSize(size!, item.unit)} = ${inr(price)}` : pieces ? 'Type a number of pieces' : `Type grams (300), kilos (1.25 kg) or switch to amount`}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
        <button type="button" style={btnGhost} onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
};

export default PackPicker;
