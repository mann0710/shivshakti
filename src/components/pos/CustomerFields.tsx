import React, { useMemo, useState } from 'react';
import type { SeasonalCustomer } from '../../hooks/useSeasonalCustomers';
import { inp, lbl } from '../ui/styles';
import { cleanPhone } from '../../lib/money';

interface Props {
  name: string;
  phone: string;
  address: string;
  customers: SeasonalCustomer[];
  required: boolean;
  onChange: (patch: { customer_name?: string; phone?: string; address?: string }) => void;
}

// Name / phone with suggestions from saved customers; picking one fills the rest.
const CustomerFields: React.FC<Props> = ({ name, phone, address, customers, required, onChange }) => {
  const [open, setOpen] = useState(required || !!(name || phone));
  const [focus, setFocus] = useState<'name' | 'phone' | null>(null);

  const query = (focus === 'phone' ? cleanPhone(phone) : name.trim().toLowerCase());
  const matches = useMemo(() => {
    if (!focus || query.length < 2) return [];
    return customers
      .filter(c => (focus === 'phone' ? (c.phone ?? '').includes(query) : c.name.toLowerCase().includes(query)))
      .slice(0, 5);
  }, [customers, focus, query]);

  if (!open && !required) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 10px', borderRadius: 10, border: '1px dashed #D0D0CC', background: '#FAFAF8', cursor: 'pointer', fontSize: 13, color: '#555' }}>
        👤 <span style={{ flex: 1, textAlign: 'left' }}>Walk-in customer</span>
        <span style={{ color: '#1A237E', fontWeight: 600, fontSize: 12 }}>+ Add details</span>
      </button>
    );
  }

  const pick = (c: SeasonalCustomer) => { onChange({ customer_name: c.name, phone: c.phone ?? '', address: c.address ?? '' }); setFocus(null); };

  return (
    <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={lbl}>Customer name{required ? ' *' : ''}</span>
        <input style={inp} value={name} placeholder={required ? 'Full name' : 'Walk-in'} autoComplete="off"
          onFocus={() => setFocus('name')} onBlur={() => setTimeout(() => setFocus(null), 150)}
          onChange={e => onChange({ customer_name: e.target.value })} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={lbl}>Mobile{required ? ' *' : ''}</span>
        <input style={inp} value={phone} placeholder="10 digits" inputMode="tel" maxLength={14} autoComplete="off"
          onFocus={() => setFocus('phone')} onBlur={() => setTimeout(() => setFocus(null), 150)}
          onChange={e => onChange({ phone: e.target.value })} />
      </label>
      <label style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={lbl}>Address</span>
        <input style={inp} value={address} placeholder="Area / City (optional)" onChange={e => onChange({ address: e.target.value })} />
      </label>
      {matches.length > 0 && (
        <div role="listbox" style={{ position: 'absolute', top: 54, left: 0, right: 0, zIndex: 20, background: '#fff', border: '1px solid #E5E5E0', borderRadius: 8, boxShadow: '0 6px 18px rgba(0,0,0,0.08)' }}>
          {matches.map(c => (
            <div key={c.id} role="option" aria-selected={false} onMouseDown={() => pick(c)}
              style={{ padding: '8px 10px', cursor: 'pointer', fontSize: 13, borderBottom: '0.5px solid #F0F0EC' }}>
              <b>{c.name}</b>{c.phone ? <span style={{ color: '#888880' }}> · {c.phone}</span> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomerFields;
