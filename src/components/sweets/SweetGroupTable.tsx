import React from 'react';
import { SeasonalItem } from '../../hooks/useSeasonalItems';
import { itemPacks } from '../../lib/itemCatalog';
import { PackDefaults, PriceUnit } from '../../lib/units';
import { SweetGroup, groupMeta } from '../../lib/sweetGroups';
import { inr } from '../../lib/money';
import SweetsMenu from './SweetsMenu';
import '../../styles/sweets.css';

export interface SweetActions {
  edit: (i: SeasonalItem) => void;
  price: (i: SeasonalItem) => void;
  flip: (ids: string[], on: boolean) => void;
  remove: (i: SeasonalItem) => void;
  mergeable: (i: SeasonalItem) => boolean;
  merge: (i: SeasonalItem) => void;
  sold: (i: SeasonalItem) => boolean;
}

interface Props { group: SweetGroup; defaults: PackDefaults; picked: Set<string>; onPick: (id: string) => void; act: SweetActions }

const UNIT_WORD: Record<PriceUnit, string> = { kg: 'kg', ltr: 'litre', pc: 'piece' };

// Shown / Hidden on the POS.
export const PosSwitch: React.FC<{ on: boolean; name: string; onChange: () => void }> = ({ on, name, onChange }) => (
  <button type="button" role="switch" aria-checked={on} aria-label={`${name} on the POS`} className="sw-switch" onClick={onChange}>
    <span className="track" aria-hidden="true" /><span className="lbl">{on ? 'Shown' : 'Hidden'}</span>
  </button>
);

// One occasion's sweets: per-kg price, the number of pack sizes, POS switch and ⋯.
const SweetGroupTable: React.FC<Props> = ({ group, defaults, picked, onPick, act }) => {
  const hidden = group.items.filter(i => !i.is_active);
  const row = (i: SeasonalItem) => {
    const packs = itemPacks(i, defaults);
    const sizes = `${packs.length} size${packs.length === 1 ? '' : 's'}`;
    const rate = `${inr(i.rate)} per ${UNIT_WORD[i.unit]}`;
    const sold = act.sold(i);
    return (
      <div key={i.id} className={`sw-row${i.is_active ? '' : ' off'}`}>
        <input type="checkbox" aria-label={`Select ${i.name}`} checked={picked.has(i.id)} onChange={() => onPick(i.id)} />
        <span className="sw-name">{i.name}{i.category && <small>{i.category}</small>}</span>
        <span className="sw-rate">{rate}<span className="sw-phone"> · {sizes}</span></span>
        <button type="button" className="sw-sizes" title={packs.map(p => `${p.label} ${inr(p.price)}`).join(' · ')} onClick={() => act.edit(i)}>{sizes}</button>
        <PosSwitch on={i.is_active} name={i.name} onChange={() => act.flip([i.id], !i.is_active)} />
        <SweetsMenu label={`More for ${i.name}`} items={[
          { label: 'Edit', onClick: () => act.edit(i), strong: true },
          { label: 'Change price', onClick: () => act.price(i) },
          { label: i.is_active ? 'Hide from the counter' : 'Put on the counter', onClick: () => act.flip([i.id], !i.is_active), sep: true },
          ...(act.mergeable(i) ? [{ label: 'Merge with…', onClick: () => act.merge(i) }] : []),
          { label: 'Delete…', onClick: () => act.remove(i), danger: true, sep: true, disabled: sold, hint: sold ? 'only if never sold' : undefined },
        ]} />
      </div>
    );
  };

  return (
    <section className="sw-group" aria-label={group.title}>
      <div className="sw-group-head">
        <h2>{group.title} <span>· {groupMeta(group)}</span></h2>
        {hidden.length === group.items.length && (
          <button type="button" className="ui-btn" onClick={() => act.flip(hidden.map(i => i.id), true)}>Put all {hidden.length} back on the POS</button>
        )}
      </div>
      <div className="sw-card sw-table">
        <div className="sw-row head" aria-hidden="true">
          <span /><span>Sweet</span><span>Price</span><span>Pack sizes</span><span>On POS</span><span />
        </div>
        {group.items.map(row)}
      </div>
    </section>
  );
};

export default SweetGroupTable;
