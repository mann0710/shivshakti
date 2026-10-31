import React, { useId, useState } from 'react';
import { Customer } from '../../types';
import { inr } from '../../lib/money';
import { findCustomers } from './bookingForm';
import { inputClass } from './FormBits';

interface Props {
  customers: Customer[];
  pickedId: string;
  newName: string;
  newPhone: string;
  onPick: (id: string) => void;
  onNew: (name: string, phone: string) => void;
  note?: (c: Customer) => string;   // e.g. "Wedding 30 Jan"
  owes?: (c: Customer) => number;
  error?: string;
}

const looksLikePhone = (s: string) => /^[\d\s+-]{3,}$/.test(s.trim());

// One customer picker: type a name or phone, pick a match, or make a new customer from name and phone.
const CustomerPicker: React.FC<Props> = ({ customers, pickedId, newName, newPhone, onPick, onNew, note, owes, error }) => {
  const id = useId();
  const picked = customers.find(c => c.id === pickedId);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [making, setMaking] = useState(!!(newName || newPhone));
  const matches = findCustomers(customers, query);
  const options = [...matches.map(c => ({ c, key: c.id })), ...(query.trim() ? [{ c: null, key: 'new' }] : [])];

  const choose = (i: number) => {
    const o = options[i];
    if (!o) return;
    setOpen(false);
    if (o.c) { onPick(o.c.id); setQuery(''); return; }
    const q = query.trim();
    onNew(looksLikePhone(q) ? '' : q, looksLikePhone(q) ? q : '');
    setMaking(true);
  };
  const onKey = (e: React.KeyboardEvent) => {
    const go = (i: number) => { e.preventDefault(); setOpen(true); setActive((i + options.length) % Math.max(1, options.length)); };
    if (e.key === 'ArrowDown') go(open ? active + 1 : 0);
    else if (e.key === 'ArrowUp') go(active - 1);
    else if (e.key === 'Enter' && open) { e.preventDefault(); choose(active); }
    else if (e.key === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); setOpen(false); }
  };

  if (making) {
    return (
      <div className="bkf-grid bkf-full">
        <label className="bkf-field">
          <span className="bkf-label">New customer name</span>
          <input className={inputClass(error)} value={newName} autoComplete="off" placeholder="Full name" onChange={e => onNew(e.target.value, newPhone)} />
        </label>
        <label className="bkf-field">
          <span className="bkf-label">Phone</span>
          <input className={inputClass(error)} type="tel" inputMode="tel" value={newPhone} placeholder="98765 43210" onChange={e => onNew(newName, e.target.value)} />
        </label>
        <span className={`bkf-hint bkf-full${error ? ' bad' : ''}`} role={error ? 'alert' : undefined}>
          {error || 'Saving the booking adds this customer. A phone you already have opens that customer instead.'}
        </span>
        <button type="button" className="ev-act bkf-full" style={{ justifySelf: 'start', marginTop: -8 }} onClick={() => { setMaking(false); onNew('', ''); }}>
          Find an existing customer instead
        </button>
      </div>
    );
  }

  const shown = picked && !query ? `${picked.name}${picked.phone ? ` · ${picked.phone}` : ''}` : query;
  return (
    <div className="bkf-field bkf-full">
      <label className="bkf-label" htmlFor={`${id}-in`}>Customer</label>
      <div className="cp">
        <input id={`${id}-in`} role="combobox" aria-expanded={open} aria-controls={`${id}-list`} aria-autocomplete="list"
          aria-activedescendant={open && options[active] ? `${id}-${options[active].key}` : undefined}
          className={inputClass(error, !!picked && !query)} value={shown} autoComplete="off" placeholder="Type a name or phone"
          onChange={e => { setQuery(e.target.value); setActive(0); setOpen(true); if (pickedId) onPick(''); }}
          onFocus={e => { setOpen(true); if (picked) e.target.select(); }} onBlur={() => setOpen(false)} onKeyDown={onKey} />
        {open && options.length > 0 && (
          <div id={`${id}-list`} role="listbox" aria-label="Customers" className="cp-list">
            {options.map((o, i) => (
              <div key={o.key} id={`${id}-${o.key}`} role="option" aria-selected={!!o.c && o.c.id === pickedId}
                className={`cp-opt${i === active ? ' on' : ''}${o.c ? '' : ' cp-new'}`}
                onMouseDown={e => { e.preventDefault(); choose(i); }} onMouseEnter={() => setActive(i)}>
                <span className="cp-mark" aria-hidden="true">{o.c && o.c.id === pickedId ? '✓' : ''}</span>
                {o.c ? (
                  <span><b>{o.c.name}</b><small>{[o.c.phone, note?.(o.c)].filter(Boolean).join(' · ')}</small></span>
                ) : <span><b>+ New customer “{query.trim()}”</b><small>Add their {looksLikePhone(query) ? 'name' : 'phone'} next</small></span>}
                <span className="cp-right">{o.c && (owes?.(o.c) ?? 0) > 0 ? `owes ${inr(owes!(o.c))}` : ''}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <span className={`bkf-hint${error ? ' bad' : ''}`} role={error ? 'alert' : undefined}>
        {error || 'Type a name or phone. Not found? Name and phone right here make a new customer.'}
      </span>
    </div>
  );
};

export default CustomerPicker;
