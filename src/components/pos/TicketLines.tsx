import React from 'react';
import { CartLine, lineKey } from '../../lib/cart';
import { formatLineSize } from '../../lib/units';
import { inr } from '../../lib/money';

interface Props {
  lines: CartLine[];
  onQty: (key: string, qty: number) => void;
}

// Receipt-style bill lines with +/− steppers; going below 1 removes the line.
const TicketLines: React.FC<Props> = ({ lines, onQty }) => (
  <div className="pos-lines" aria-label="Bill lines">
    {lines.length === 0 ? (
      <div style={{ textAlign: 'center', color: '#AAAAAA', padding: '28px 8px', fontSize: 13 }}>
        <div style={{ fontSize: 28, marginBottom: 6 }}>🧾</div>
        No items yet. Tap a pack size to add it.
      </div>
    ) : lines.map(l => {
      const key = lineKey(l);
      return (
        <div key={key} className="pos-line">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.item_name}</div>
            <div style={{ fontSize: 11, color: '#888880' }}>{formatLineSize(l.weight, l.weight_unit)} · {inr(l.price)}</div>
          </div>
          <div className="pos-qty">
            <button type="button" aria-label={`One less ${l.item_name}`} onClick={() => onQty(key, l.qty - 1)}>{l.qty === 1 ? '🗑' : '−'}</button>
            <span>{l.qty}</span>
            <button type="button" aria-label={`One more ${l.item_name}`} onClick={() => onQty(key, l.qty + 1)}>+</button>
          </div>
          <div style={{ width: 72, textAlign: 'right', fontWeight: 700, fontSize: 13 }}>{inr(l.line_total)}</div>
        </div>
      );
    })}
  </div>
);

export default TicketLines;
