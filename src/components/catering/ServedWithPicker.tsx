import React, { useMemo, useState } from 'react';
import { QuotationLineItem } from '../../hooks/useQuotations';
import { isAccompaniment, servedNames } from '../../lib/menuOrder';
import type { PickerItem } from './QuotationItemPanels';

interface Props {
  item: QuotationLineItem;
  menuItems: PickerItem[];
  onChange: (change: Pick<QuotationLineItem, 'served_with' | 'served_ids'>) => void;
}

const GREEN = '#2E7D32';

// "Served with": accompaniment items from the menu (several allowed), shown as chips.
const ServedWithPicker: React.FC<Props> = ({ item, menuItems, onChange }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const picked = servedNames(item);
  const term = q.trim().toLowerCase();

  // Accompaniments first; search reaches every menu item.
  const list = useMemo(() => menuItems
    .filter(m => m.id !== item.item_id)
    .map(m => ({ m, acc: isAccompaniment(m.subcategory?.category?.name, m.subcategory?.name, m.name) }))
    .filter(x => (term ? x.m.name.toLowerCase().includes(term) : x.acc))
    .sort((a, b) => Number(b.acc) - Number(a.acc) || a.m.name.localeCompare(b.m.name))
    .slice(0, 12), [menuItems, item.item_id, term]);

  const save = (names: string[]) => onChange({
    served_with: names.join(', ') || undefined,
    served_ids: names.map(n => menuItems.find(m => m.name === n)?.id).filter((x): x is string => !!x),
  });
  const toggle = (name: string) => save(picked.includes(name) ? picked.filter(n => n !== name) : [...picked, name]);

  // Chips sit beside the instruction; the list opens full width below (parent wraps).
  return (
    <>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
        {picked.map(n => (
          <span key={n} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: GREEN, background: '#EEF6E8', border: '0.5px solid #B9D9A3', borderRadius: 10, padding: '1px 4px 1px 8px' }}>
            with {n}
            <button type="button" onClick={() => toggle(n)} aria-label={`Remove ${n}`} style={{ border: 'none', background: 'none', color: GREEN, cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: '0 2px' }}>×</button>
          </span>
        ))}
        <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
          style={{ fontSize: 11, color: picked.length ? GREEN : '#AAAAAA', background: 'none', border: `1px dashed ${picked.length ? '#B9D9A3' : '#E0E0DC'}`, borderRadius: 10, padding: '1px 8px', cursor: 'pointer' }}>
          {picked.length ? '+ more' : '+ Served with…'}
        </button>
      </div>
      {open && (
        <div style={{ flexBasis: '100%', border: '1px solid #B9D9A3', borderRadius: 8, background: '#fff', overflow: 'hidden' }}>
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Accompaniments — search any dish…" aria-label="Search accompaniments"
            onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }}
            style={{ width: '100%', boxSizing: 'border-box', border: 'none', borderBottom: '0.5px solid #E5E5E0', padding: '6px 8px', fontSize: 12, outline: 'none' }} />
          <div style={{ maxHeight: 180, overflowY: 'auto' }}>
            {list.map(({ m }) => {
              const on = picked.includes(m.name);
              return (
                <button key={m.id} type="button" onClick={() => toggle(m.name)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '5px 8px', border: 'none', borderTop: '0.5px solid #F2F2EE', background: on ? '#F4FAEE' : '#fff', cursor: 'pointer', fontSize: 12, textAlign: 'left' }}>
                  <span style={{ width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${on ? GREEN : '#C9C9C2'}`, background: on ? GREEN : '#fff', color: '#fff', fontSize: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{on ? '✓' : ''}</span>
                  <span style={{ flex: 1 }}>{m.name}</span>
                  <span style={{ fontSize: 10.5, color: '#888880' }}>{m.subcategory?.name}</span>
                </button>
              );
            })}
            {!list.length && <div style={{ padding: 8, fontSize: 12, color: '#888880' }}>{term ? 'No dish matches.' : 'No accompaniments yet — type to search any dish, or add an Accompaniments category in Menu Builder.'}</div>}
          </div>
          <button type="button" onClick={() => setOpen(false)} style={{ width: '100%', border: 'none', borderTop: '0.5px solid #E5E5E0', background: '#F9F8F5', padding: '5px', fontSize: 11.5, fontWeight: 600, color: GREEN, cursor: 'pointer' }}>Done</button>
        </div>
      )}
    </>
  );
};

export default ServedWithPicker;
