import React, { useMemo, useRef, useState } from 'react';
import { SeasonalItem, itemPacks } from '../../lib/itemCatalog';
import { Pack, PackDefaults } from '../../lib/units';
import ProductTile from './ProductTile';
import { empty } from '../ui/styles';
import './pos.css';

interface Props {
  items: SeasonalItem[];          // active items for the chosen occasion
  defaults: PackDefaults;
  popularity: Map<string, number>; // fixed for the session, so tiles never move while serving
  inCart: Map<string, number>;
  onAdd: (item: SeasonalItem, pack: Pack) => void;
  onOpen: (item: SeasonalItem) => void;
  onLoose: (item: SeasonalItem) => void;
  toolbar?: React.ReactNode;
}

const ALL = '__all';

// Search + category chips + touch-friendly tiles, most-sold first.
const ProductGrid: React.FC<Props> = ({ items, defaults, popularity, inCart, onAdd, onOpen, onLoose, toolbar }) => {
  const [query, setQuery] = useState('');
  const [picked, setChip] = useState(ALL);
  const inputRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(
    () => Array.from(new Set(items.map(i => i.category).filter(Boolean) as string[])).sort(),
    [items],
  );
  // A category missing after the occasion changes falls back to All.
  const chip = picked === ALL || categories.includes(picked) ? picked : ALL;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter(i => (q ? i.name.toLowerCase().includes(q) : chip === ALL || i.category === chip))
      .sort((a, b) => (popularity.get(b.id) ?? 0) - (popularity.get(a.id) ?? 0) || a.name.localeCompare(b.name));
  }, [items, query, chip, popularity]);

  const packMap = useMemo(() => new Map(items.map(i => [i.id, itemPacks(i, defaults)])), [items, defaults]);
  const packsOf = (i: SeasonalItem) => packMap.get(i.id) ?? [];

  // Enter adds the top match when it has a single pack, else opens its picker.
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') setQuery('');
    if (e.key !== 'Enter' || !shown.length) return;
    const top = shown[0];
    const packs = packsOf(top);
    if (packs.length === 1) onAdd(top, packs[0]); else onOpen(top);
    setQuery('');
  };

  return (
    <div className="pos-panel" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="pos-search" style={{ flex: '1 1 220px' }}>
          <span className="ico" aria-hidden="true">🔍</span>
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={onKeyDown}
            placeholder="Search sweets… (Enter to add)" aria-label="Search items" autoComplete="off" />
          {query && <button type="button" className="clr" aria-label="Clear search" onClick={() => { setQuery(''); inputRef.current?.focus(); }}>×</button>}
        </div>
        {toolbar}
      </div>

      {categories.length > 0 && !query && (
        <div className="pos-chips" role="group" aria-label="Categories">
          {[ALL, ...categories].map(c => (
            <button key={c} type="button" className={`pos-chip${chip === c ? ' on' : ''}`} aria-pressed={chip === c} onClick={() => setChip(c)}>
              {c === ALL ? `All (${items.length})` : c}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <div style={empty}>
          {items.length === 0
            ? 'No active items for this occasion. Add items in Sessional Items.'
            : `No items match "${query}".`}
        </div>
      ) : (
        <div className="pos-tiles">
          {shown.map(i => (
            <ProductTile key={i.id} item={i} packs={packsOf(i)} inCart={inCart.get(i.id) ?? 0} onAdd={onAdd} onOpen={onOpen} onLoose={onLoose} />
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductGrid;
