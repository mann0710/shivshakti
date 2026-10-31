import React, { useMemo, useState } from 'react';
import { QuotationLineItem } from '../../hooks/useQuotations';
import type { PickerItem } from '../../lib/quoteLines';

interface Props {
  forName: string;          // dish the alternatives are for
  course: string;           // its course, suggested first
  menuItems: PickerItem[];
  items: QuotationLineItem[];
  onOffer: (picks: { menu?: PickerItem; existing?: QuotationLineItem }[]) => void;
  onClose: () => void;
}

// "Offer instead of Puri": tick one or more dishes; the customer picks one of them.
const AlternativePicker: React.FC<Props> = ({ forName, course, menuItems, items, onOffer, onClose }) => {
  const [q, setQ] = useState('');
  const [ticked, setTicked] = useState<string[]>([]);
  const term = q.trim().toLowerCase();
  const inMenu = useMemo(() => new Set(items.map(i => i.item_id)), [items]);

  const fromQuote = items.filter(i => !i.choice && i.item_name !== forName && (term ? i.item_name.toLowerCase().includes(term) : i.subcategory_name === course));
  const fromMenu = useMemo(() => menuItems
    .filter(m => !inMenu.has(m.id) && (!term || m.name.toLowerCase().includes(term)))
    .sort((a, b) => Number(b.subcategory?.name === course) - Number(a.subcategory?.name === course) || a.name.localeCompare(b.name))
    .slice(0, 30), [menuItems, inMenu, term, course]);

  const toggle = (id: string) => setTicked(t => (t.includes(id) ? t.filter(x => x !== id) : [...t, id]));
  const offer = () => onOffer(ticked.map(id => ({ existing: items.find(i => i.item_id === id), menu: menuItems.find(m => m.id === id) })));
  const row = (id: string, name: string, sub: string) => {
    const on = ticked.includes(id);
    return (
      <button key={id} type="button" role="option" aria-selected={on} className={`q-pick-item${on ? ' on' : ''}`} onClick={() => toggle(id)}>
        <span className="tick" aria-hidden="true">{on ? '✓' : ''}</span>
        <span>{name}<small>{sub}</small></span>
      </button>
    );
  };

  return (
    <div className="q-picker">
      <div className="q-pick-head">Offer instead of {forName}</div>
      <input className="q-pick-search" value={q} onChange={e => setQ(e.target.value)} placeholder={`Search ${menuItems.length.toLocaleString('en-IN')} dishes`}
        aria-label={`Dishes to offer instead of ${forName}`} onKeyDown={e => { if (e.key === 'Escape') onClose(); }} />
      <div className="q-pick-list" role="listbox" aria-multiselectable="true">
        {fromQuote.map(i => row(i.item_id, i.item_name, 'already in the menu'))}
        {fromMenu.map(m => row(m.id, m.name, m.subcategory?.name || ''))}
        {!fromQuote.length && !fromMenu.length && <p className="q-hint q-pad">No dish matches. Add it in Menu Builder first.</p>}
      </div>
      <div className="q-pick-foot">
        <span>Customer picks one</span>
        <button type="button" className="ui-btn primary" disabled={!ticked.length} onClick={offer}>Offer {ticked.length || ''}</button>
      </div>
    </div>
  );
};

export default AlternativePicker;
