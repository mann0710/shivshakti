import React, { useEffect, useState } from 'react';

interface Props { value?: number | null; onSave: (price: number | null) => void }

const toText = (v?: number | null) => (v ? String(v) : '');

// Inline default price for a menu item; saves on blur or Enter, empty clears it.
const MenuItemPrice: React.FC<Props> = ({ value, onSave }) => {
  const [text, setText] = useState(toText(value));
  useEffect(() => { setText(toText(value)); }, [value]);

  const commit = () => {
    const next = parseFloat(text);
    const price = next > 0 ? next : null;
    if (price !== (value || null)) onSave(price);
    else setText(toText(value));
  };

  return (
    <label title="Default price per plate, filled into new quotations" style={wrap}>
      <span style={{ color: '#888880' }}>₹</span>
      <input type="number" min="0" inputMode="decimal" placeholder="price" value={text} aria-label="Default price"
        onChange={e => setText(e.target.value)} onBlur={commit}
        onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} style={field} />
    </label>
  );
};

const wrap: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 2, fontSize: 12 };
const field: React.CSSProperties = { width: 58, border: '0.5px solid #D0D0CC', borderRadius: 6, padding: '3px 5px', fontSize: 12, textAlign: 'right', background: '#fff', color: '#1A1A18' };

export default MenuItemPrice;
