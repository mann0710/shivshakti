import React, { useEffect, useState } from 'react';

// Typed quantity: applies as you type, empty or 0 snaps back on blur (the bin removes a line).
const QtyInput: React.FC<{ qty: number; label: string; onQty: (q: number) => void }> = ({ qty, label, onQty }) => {
  const [text, setText] = useState(String(qty));
  useEffect(() => setText(String(qty)), [qty]);
  return (
    <input type="text" inputMode="numeric" aria-label={`Quantity of ${label}`} value={text}
      onFocus={e => e.target.select()}
      onChange={e => {
        const v = e.target.value.replace(/\D/g, '').slice(0, 4);
        setText(v);
        if (Number(v) > 0) onQty(Number(v));
      }}
      onBlur={() => setText(String(qty))}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
  );
};

export default QtyInput;
