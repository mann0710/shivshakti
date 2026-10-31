import React, { useId, useMemo, useState } from 'react';
import { CatNode, searchSubs } from '../../lib/menuCatalog';

interface Props { tree: CatNode[]; value: string; onChange: (id: string) => void; autoFocus?: boolean; bad?: boolean }

// Type to find a subcategory ("main far" → Main Course › Farsan); arrows and Enter pick, Esc keeps the old one.
const SubPicker: React.FC<Props> = ({ tree, value, onChange, autoFocus, bad }) => {
  const listId = useId();
  const all = useMemo(() => searchSubs(tree, ''), [tree]);
  const label = (id: string) => { const o = all.find(x => x.id === id); return o ? `${o.cat} › ${o.sub}` : ''; };
  const [term, setTerm] = useState<string | null>(null);
  const [hi, setHi] = useState(0);
  const hits = useMemo(() => (term === null ? [] : searchSubs(tree, term)), [tree, term]);
  const pick = (id?: string) => { if (id) onChange(id); setTerm(null); setHi(0); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setTerm(t => t ?? ''); setHi(h => Math.min(h + 1, Math.max(hits.length - 1, 0))); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
    if (e.key === 'Enter' && term !== null) { e.preventDefault(); pick(hits[hi]?.id); }
    if (e.key === 'Escape' && term !== null) { e.stopPropagation(); setTerm(null); }
  };
  return (
    <div className="st-combo">
      <input type="search" role="combobox" aria-label="Subcategory" aria-autocomplete="list" aria-expanded={term !== null} aria-controls={listId}
        className={bad ? 'bad' : ''} autoFocus={autoFocus} placeholder="Type to search, e.g. farsan or sweet"
        value={term ?? label(value)} onFocus={e => { setTerm(''); e.currentTarget.select(); }} onBlur={() => setTerm(null)}
        onChange={e => { setTerm(e.target.value); setHi(0); }} onKeyDown={onKey} />
      {term !== null && (
        <ul id={listId} role="listbox">
          {hits.slice(0, 60).map((o, i) => (
            <li key={o.id}>
              <button type="button" role="option" aria-selected={i === hi} className={`${i === hi ? 'hi' : ''}${o.id === value ? ' cur' : ''}`}
                onMouseDown={e => e.preventDefault()} onClick={() => pick(o.id)}>
                <span>{o.sub}</span><small>{o.cat}</small>
              </button>
            </li>
          ))}
          {!hits.length && <li className="st-combo-none">No subcategory matches "{term.trim()}".</li>}
        </ul>
      )}
    </div>
  );
};

export default SubPicker;
