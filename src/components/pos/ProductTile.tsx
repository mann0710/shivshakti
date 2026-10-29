import React, { memo } from 'react';
import { SeasonalItem } from '../../lib/itemCatalog';
import { Pack, rateLabel } from '../../lib/units';
import { inr } from '../../lib/money';

interface Props {
  item: SeasonalItem;
  packs: Pack[];
  inCart: number;
  onAdd: (item: SeasonalItem, pack: Pack) => void;
  onOpen: (item: SeasonalItem) => void;
}

const MAX_CHIPS = 4;

// Stable colour per name so every sweet keeps the same avatar.
export const hueOf = (name: string) => Array.from(name).reduce((h, ch) => (h * 31 + (ch.codePointAt(0) ?? 0)) % 360, 0);

// One tap on a pack adds it; tapping the name opens custom weight / amount.
const ProductTile: React.FC<Props> = ({ item, packs, inCart, onAdd, onOpen }) => {
  const hue = hueOf(item.name);
  const chips = packs.slice(0, MAX_CHIPS);
  return (
    <div className={`pos-tile${inCart ? ' in-cart' : ''}`}>
      <button type="button" className="pos-tile-main" onClick={() => onOpen(item)}
        aria-label={`${item.name}, ${rateLabel(item.rate, item.unit)}. Choose quantity`}>
        <span className="pos-avatar" style={{ background: `hsl(${hue} 60% 50% / 0.14)`, color: `hsl(${hue} 55% 30%)` }}>
          {Array.from(item.name.trim())[0]?.toUpperCase() ?? '?'}
        </span>
        <span style={{ minWidth: 0 }}>
          <span className="pos-tile-name">{item.name}</span>
          <span className="pos-tile-rate" style={{ display: 'block' }}>{rateLabel(item.rate, item.unit)}</span>
        </span>
      </button>
      {inCart > 0 && <span className="pos-badge" aria-hidden="true">{inCart}</span>}
      <div className="pos-packs" role="group" aria-label={`Packs of ${item.name}`}>
        {chips.map(p => (
          <button key={p.size} type="button" className="pos-pack" onClick={() => onAdd(item, p)}
            aria-label={`Add ${p.label} ${item.name}, ${inr(p.price)}`}>
            <span>{p.label}</span>
            <span className="p">{inr(p.price)}</span>
          </button>
        ))}
        <button type="button" className="pos-pack more" onClick={() => onOpen(item)}>
          {packs.length > MAX_CHIPS ? `+${packs.length - MAX_CHIPS} more` : 'Custom'}
        </button>
      </div>
    </div>
  );
};

export default memo(ProductTile);
