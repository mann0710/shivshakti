import React, { useMemo, useState } from 'react';
import { QuotationLineItem } from '../../hooks/useQuotations';
import type { PickerItem } from './QuotationItemPanels';

interface Props {
  forName: string;          // dish (or group) the alternative is for
  course: string;           // its subcategory, suggested first
  menuItems: PickerItem[];
  items: QuotationLineItem[];
  showPrices: boolean;
  onPick: (pick: { menu?: PickerItem; existing?: QuotationLineItem }) => void;
  onClose: () => void;
}

// Inline search: "Offer instead of Churma Na Ladoo" — same-course dishes first, then the rest.
const AlternativePicker: React.FC<Props> = ({ forName, course, menuItems, items, showPrices, onPick, onClose }) => {
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();
  const inMenu = useMemo(() => new Set(items.map(i => i.item_id)), [items]);

  const fromMenu = useMemo(() => menuItems
    .filter(m => !inMenu.has(m.id) && (!term || m.name.toLowerCase().includes(term)))
    .sort((a, b) => Number(b.subcategory?.name === course) - Number(a.subcategory?.name === course) || a.name.localeCompare(b.name))
    .slice(0, 8), [menuItems, inMenu, term, course]);
  const fromQuote = items.filter(i => !i.choice && i.item_name !== forName && (term ? i.item_name.toLowerCase().includes(term) : i.subcategory_name === course)).slice(0, 4);

  const option = (key: string, label: string, sub: string, price: number | null | undefined, act: () => void) => (
    <button key={key} type="button" onClick={act}
      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 10px', border: 'none', borderTop: '0.5px solid #F2EBE0', background: '#fff', cursor: 'pointer', textAlign: 'left', fontSize: 13 }}>
      <span style={{ flex: 1 }}>{label}</span>
      <span style={{ fontSize: 11, color: '#888880' }}>{sub}</span>
      {showPrices && !!price && <span style={{ fontSize: 12, color: '#555550' }}>₹{price.toLocaleString('en-IN')}</span>}
      <span style={{ fontSize: 12, fontWeight: 600, color: '#A84F00' }}>Offer</span>
    </button>
  );

  return (
    <div style={{ margin: '2px 8px 8px 28px', border: '1px solid #E8A867', borderRadius: 8, background: '#FFFCF8', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#A84F00', whiteSpace: 'nowrap' }}>Offer instead of {forName}:</span>
        <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search dishes…" aria-label={`Alternative to ${forName}`}
          onKeyDown={e => { if (e.key === 'Escape') onClose(); if (e.key === 'Enter' && fromMenu[0]) onPick({ menu: fromMenu[0] }); }}
          style={{ flex: 1, minWidth: 0, border: '1px solid #E5E5E0', borderRadius: 6, padding: '5px 8px', fontSize: 12 }} />
        <button type="button" onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'none', fontSize: 16, color: '#888880', cursor: 'pointer' }}>×</button>
      </div>
      {fromQuote.map(i => option(`q:${i.item_id}`, i.item_name, 'already in menu', i.amount, () => onPick({ existing: i })))}
      {fromMenu.map(m => option(`m:${m.id}`, m.name, m.subcategory?.name || '', m.default_price, () => onPick({ menu: m })))}
      {!fromQuote.length && !fromMenu.length && <div style={{ padding: '10px', fontSize: 12, color: '#888880' }}>No dish matches. Add it in Menu Builder first.</div>}
    </div>
  );
};

export default AlternativePicker;
