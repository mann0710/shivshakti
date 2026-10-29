import React from 'react';
import { box, btnPrimary, inp, outlineBtn, xBtn } from './InvoiceUi';

export interface ChargeRow { id?: string; description: string; amount: number }

interface ListProps<T extends ChargeRow> {
  heading: React.ReactNode;
  color: string;
  items: T[];
  onChange: (items: T[]) => void;
  make: () => T;
  empty: string;
  placeholder?: string;
}

// Editable "description + amount" rows for extra charges, transport and discounts.
function InvoiceChargeList<T extends ChargeRow>({ heading, color, items, onChange, make, empty, placeholder = 'Description' }: ListProps<T>) {
  const patch = (i: number, p: Partial<ChargeRow>) => onChange(items.map((x, j) => (j === i ? { ...x, ...p } : x)));
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        {heading}
        <button type="button" onClick={() => onChange([...items, make()])} style={outlineBtn(color)}>+ Add</button>
      </div>
      {items.length === 0 && <div style={{ fontSize: 11, color: '#AAAAAA', marginBottom: 6 }}>{empty}</div>}
      {items.map((it, i) => (
        <div key={it.id ?? i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
          <input placeholder={placeholder} value={it.description}
            onChange={e => patch(i, { description: e.target.value })}
            style={{ ...inp, flex: 1, minWidth: 0, fontSize: 12 }} />
          <input type="number" min="0" inputMode="decimal" placeholder="₹ 0" value={it.amount || ''}
            onChange={e => patch(i, { amount: parseFloat(e.target.value) || 0 })}
            style={{ ...inp, width: 90, fontSize: 12, textAlign: 'right' }} />
          <button type="button" aria-label="Remove" onClick={() => onChange(items.filter((_, j) => j !== i))} style={xBtn}>×</button>
        </div>
      ))}
    </>
  );
}

interface BoxProps<T extends ChargeRow> {
  title: string;
  color: string;
  items: T[];
  onChange: (items: T[]) => void;
  make: () => T;
  empty: string;
  applyLabel: string;
  onApply: () => void;
  pending: boolean;
  applied?: string;
}

// A boxed charge list with its own Apply button.
export function InvoiceChargeBox<T extends ChargeRow>({ title, color, items, onChange, make, empty, applyLabel, onApply, pending, applied }: BoxProps<T>) {
  return (
    <div style={box}>
      <InvoiceChargeList heading={<div style={{ fontSize: 12, fontWeight: 600, color: '#444440' }}>{title}</div>}
        color={color} items={items} onChange={onChange} make={make} empty={empty} />
      {items.length > 0 && (
        <button type="button" onClick={onApply} disabled={pending} style={{ ...btnPrimary, fontSize: 12, width: '100%', marginTop: 4, background: color }}>
          {pending ? '...' : applyLabel}
        </button>
      )}
      {applied && <div style={{ fontSize: 11, color: '#666660', marginTop: 6 }}>{applied}</div>}
    </div>
  );
}

export default InvoiceChargeList;
