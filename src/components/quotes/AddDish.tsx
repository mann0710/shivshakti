import React, { useId, useMemo, useState } from 'react';
import { searchDishes, PickerItem } from '../../lib/quoteLines';
import { inr } from '../../lib/money';

interface Props {
  menu: PickerItem[];
  skip: Set<string>;
  onPick: (it: PickerItem) => void;
  placeholder?: string;
  showPrices?: boolean;
  autoFocus?: boolean;
  onBlurEmpty?: () => void;
}

// "Add a dish — type a name, it lands in the right course."
const AddDish: React.FC<Props> = ({ menu, skip, onPick, placeholder = 'Add a dish — type a name, it lands in the right course', showPrices, autoFocus, onBlurEmpty }) => {
  const listId = useId();
  const [term, setTerm] = useState('');
  const [hi, setHi] = useState(0);
  const hits = useMemo(() => searchDishes(menu, term, skip), [menu, term, skip]);
  const pick = (it?: PickerItem) => { if (!it) return; onPick(it); setTerm(''); setHi(0); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, hits.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
    if (e.key === 'Enter') { e.preventDefault(); pick(hits[hi]); }
    if (e.key === 'Escape') setTerm('');
  };
  return (
    <div className="q-adddish">
      <label>
        <span aria-hidden="true">+</span>
        <input type="search" value={term} autoFocus={autoFocus} placeholder={placeholder} aria-label="Add a dish" role="combobox"
          aria-expanded={hits.length > 0} aria-controls={listId} onChange={e => { setTerm(e.target.value); setHi(0); }} onKeyDown={onKey}
          onBlur={() => { if (!term) onBlurEmpty?.(); }} />
      </label>
      {term.trim() && (
        <ul id={listId} role="listbox">
          {hits.map((it, i) => (
            <li key={it.id}>
              <button type="button" role="option" aria-selected={i === hi} className={i === hi ? 'hi' : ''} onMouseDown={e => e.preventDefault()} onClick={() => pick(it)}>
                <span>{it.name} <small>{it.subcategory?.name}</small></span>
                {showPrices && !!it.default_price && <small>{inr(it.default_price)}</small>}
              </button>
            </li>
          ))}
          {!hits.length && <li className="q-hint q-pad">No dish called "{term.trim()}". Add it in Menu Builder first.</li>}
        </ul>
      )}
    </div>
  );
};

export default AddDish;
