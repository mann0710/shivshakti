import React, { useMemo, useState } from 'react';
import { QuotationLineItem } from '../../hooks/useQuotations';
import { isAccompaniment, servedNames } from '../../lib/menuOrder';
import type { PickerItem } from '../../lib/quoteLines';

interface Props {
  item: QuotationLineItem;
  menuItems: PickerItem[];
  onChange: (change: Pick<QuotationLineItem, 'served_with' | 'served_ids'>) => void;
  onDone: () => void;
}

// "Served with South Boll": accompaniments first, search reaches every dish; several allowed.
const ServedWithPicker: React.FC<Props> = ({ item, menuItems, onChange, onDone }) => {
  const [q, setQ] = useState('');
  const picked = servedNames(item);
  const term = q.trim().toLowerCase();

  const list = useMemo(() => menuItems
    .filter(m => m.id !== item.item_id)
    .map(m => ({ m, acc: isAccompaniment(m.subcategory?.category?.name, m.subcategory?.name, m.name) }))
    .filter(x => (term ? x.m.name.toLowerCase().includes(term) : x.acc || picked.includes(x.m.name)))
    .sort((a, b) => Number(picked.includes(b.m.name)) - Number(picked.includes(a.m.name)) || Number(b.acc) - Number(a.acc) || a.m.name.localeCompare(b.m.name))
    .slice(0, 30), [menuItems, item.item_id, term, picked]);

  const save = (names: string[]) => onChange({
    served_with: names.join(', ') || undefined,
    served_ids: names.map(n => menuItems.find(m => m.name === n)?.id).filter((x): x is string => !!x),
  });
  const toggle = (name: string) => save(picked.includes(name) ? picked.filter(n => n !== name) : [...picked, name]);

  return (
    <div className="q-picker">
      <div className="q-pick-head">Served with {item.item_name}</div>
      <input className="q-pick-search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search accompaniments or any dish" aria-label="Search dishes to serve with" />
      <div className="q-pick-list" role="listbox" aria-multiselectable="true">
        {list.map(({ m }) => {
          const on = picked.includes(m.name);
          return (
            <button key={m.id} type="button" role="option" aria-selected={on} className={`q-pick-item${on ? ' on' : ''}`} onClick={() => toggle(m.name)}>
              <span className="tick" aria-hidden="true">{on ? '✓' : ''}</span>
              <span>{m.name}<small>{m.subcategory?.name}</small></span>
            </button>
          );
        })}
        {!list.length && <p className="q-hint q-pad">{term ? 'No dish matches.' : 'No accompaniments yet — type to search any dish.'}</p>}
      </div>
      <div className="q-pick-foot">
        <span>{picked.length} picked</span>
        <button type="button" className="ui-btn primary" onClick={onDone}>Done</button>
      </div>
    </div>
  );
};

export default ServedWithPicker;
