import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { PriceUnit, formatSize, parseSize, cleanSizes, UNITS } from '../../lib/units';
import { inp, btnSm, NAVY } from '../ui/styles';

interface Props {
  unit: PriceUnit;
  sizes: number[];
  onChange: (sizes: number[]) => void;
  disabled?: boolean;
}

// Editable pack-size chips: × removes one, the box adds a custom size ("400", "1.5 kg").
const SizeChips: React.FC<Props> = ({ unit, sizes, onChange, disabled }) => {
  const [text, setText] = useState('');

  const add = () => {
    const size = parseSize(text, unit);
    if (!size) { toast.error(unit === 'pc' ? 'Enter a number of pieces' : `Enter a size like 400 or 1.5 ${UNITS[unit].label}`); return; }
    onChange(cleanSizes([...sizes, size]));
    setText('');
  };

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {sizes.length === 0 && <span style={{ fontSize: 12, color: '#AAAAAA' }}>No sizes yet</span>}
        {sizes.map(s => (
          <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#F3F2EE', color: NAVY, borderRadius: 14, padding: '4px 6px 4px 10px', fontSize: 12, fontWeight: 600 }}>
            {formatSize(s, unit)}
            {!disabled && (
              <button type="button" aria-label={`Remove ${formatSize(s, unit)}`} onClick={() => onChange(sizes.filter(x => x !== s))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: NAVY, fontSize: 14, lineHeight: 1, padding: '0 2px' }}>×</button>
            )}
          </span>
        ))}
      </div>
      {!disabled && (
        <div style={{ display: 'flex', gap: 6 }}>
          <input style={{ ...inp, maxWidth: 200 }} value={text} inputMode="decimal" onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
            placeholder={unit === 'pc' ? 'e.g. 12' : `e.g. 400 ${UNITS[unit].base} or 2 ${UNITS[unit].label}`} />
          <button type="button" style={btnSm} onClick={add}>+ Add size</button>
        </div>
      )}
    </div>
  );
};

export default SizeChips;
