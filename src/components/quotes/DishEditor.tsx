import React, { useState } from 'react';
import type { QuotationLineItem } from '../../hooks/useQuotations';
import { addAlternative, tidyGroups } from '../../lib/quoteChoices';
import { servedNames } from '../../lib/menuOrder';
import type { PickerItem } from '../../lib/quoteLines';
import ServedWithPicker from '../catering/ServedWithPicker';
import AlternativePicker from '../catering/AlternativePicker';
import Popover from './Popover';

interface Props {
  anchor: HTMLElement | null;
  item: QuotationLineItem;
  items: QuotationLineItem[];
  menu: PickerItem[];
  toLine: (it: PickerItem) => QuotationLineItem;
  onChange: (next: QuotationLineItem[]) => void;
  onClose: () => void;
}

// Tap a dish: its price, a note, "served with" items, offer another, or remove it.
const DishEditor: React.FC<Props> = ({ anchor, item, items, menu, toLine, onChange, onClose }) => {
  const [mode, setMode] = useState<'edit' | 'served' | 'offer'>('edit');
  const patch = (change: Partial<QuotationLineItem>) => onChange(items.map(i => (i.item_id === item.item_id ? { ...i, ...change } : i)));
  const remove = () => { onChange(tidyGroups(items.filter(i => i.item_id !== item.item_id))); onClose(); };
  // Each ticked dish joins the same "customer picks one" group as this dish.
  const offer = (picks: { menu?: PickerItem; existing?: QuotationLineItem }[]) => {
    let next = items;
    let target: { itemId?: string; groupId?: string } = item.choice ? { groupId: item.choice.id } : { itemId: item.item_id };
    for (const p of picks) {
      const alt = p.existing ?? (p.menu && toLine(p.menu));
      if (!alt) continue;
      next = addAlternative(next, target, alt);
      const g = next.find(i => i.item_id === item.item_id)?.choice?.id;
      if (g) target = { groupId: g };
    }
    onChange(next);
    onClose();
  };
  const served = servedNames(item);

  return (
    <Popover anchor={anchor} label={item.item_name} width={mode === 'edit' ? 300 : 340} onClose={onClose}>
      {mode === 'served' ? <ServedWithPicker item={item} menuItems={menu} onChange={patch} onDone={() => setMode('edit')} />
        : mode === 'offer' ? <AlternativePicker forName={item.item_name} course={item.subcategory_name} menuItems={menu} items={items} onOffer={offer} onClose={() => setMode('edit')} />
          : (
            <div className="q-dish-ed">
              <div className="q-pick-head">{item.item_name}<small>{item.subcategory_name || item.category_name}</small></div>
              <label className="q-field">Price a plate
                <input type="number" min={0} inputMode="decimal" value={item.amount || ''} placeholder="Part of the plate price"
                  onChange={e => patch({ amount: Math.max(0, parseFloat(e.target.value) || 0) })} />
              </label>
              <label className="q-field">Note on the PDF
                <input value={item.instruction || ''} placeholder="e.g. less spicy, live counter" onChange={e => patch({ instruction: e.target.value || undefined })} />
              </label>
              <div className="q-menu">
                <button type="button" onClick={() => setMode('served')}>Served with…{served.length ? <small> {served.join(', ')}</small> : null}</button>
                <button type="button" onClick={() => setMode('offer')}>{item.choice ? 'Offer one more instead…' : 'Offer another instead…'}</button>
                {item.choice && <button type="button" onClick={() => onChange(tidyGroups(items.map(i => (i.item_id === item.item_id ? { ...i, choice: undefined, chosen: undefined } : i))))}>Always serve it (not a choice)</button>}
                <hr />
                <button type="button" className="danger" onClick={remove}>Remove from the menu</button>
              </div>
            </div>
          )}
    </Popover>
  );
};

export default DishEditor;
