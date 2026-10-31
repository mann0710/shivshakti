import React, { useEffect, useRef, useState } from 'react';
import { Dish, placeOf, plural } from '../../lib/menuCatalog';
import DotsMenu from '../people/DotsMenu';
import { Switch } from './SettingsUi';
import '../../styles/settings.css';

export interface Group { kind: 'cat' | 'sub'; id: string; name: string; is_active: boolean }

export interface DishActions {
  price: (d: Dish, price: number | null) => void;
  shown: (d: Dish, on: boolean) => void;
  edit: (d: Dish) => void;
  move: (d: Dish) => void;
  duplicate: (d: Dish) => void;
  remove: (d: Dish) => void;
  add: (name: string, price: number | null) => Promise<void>;
  renameGroup: (g: Group) => void;
  shownGroup: (g: Group) => void;
  removeGroup: (g: Group) => void;
}

interface Props {
  crumb: string;
  title: string;
  group: Group | null;
  dishes: Dish[];
  showPlace: boolean;
  hasPrice: boolean;
  addTo: string | null;
  fresh: string | null;
  act: DishActions;
}

const PAGE = 150;

// Price box that saves on blur or Enter; empty clears the price.
const PriceBox: React.FC<{ d: Dish; onSave: (p: number | null) => void; focusKey: number }> = ({ d, onSave, focusKey }) => {
  const [text, setText] = useState(d.default_price ? String(d.default_price) : '');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { setText(d.default_price ? String(d.default_price) : ''); }, [d.default_price]);
  useEffect(() => { if (focusKey) ref.current?.focus(); }, [focusKey]);
  const commit = () => {
    const p = parseFloat(text) > 0 ? parseFloat(text) : null;
    if (p !== (Number(d.default_price) > 0 ? Number(d.default_price) : null)) onSave(p);
  };
  return (
    <label className="mb-price">
      <span aria-hidden="true">₹</span>
      <input ref={ref} inputMode="decimal" placeholder="Set price" aria-label={`Price per plate for ${d.name}`} value={text}
        onChange={e => setText(e.target.value.replace(/[^\d.]/g, ''))} onBlur={commit} onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
    </label>
  );
};

// The dishes of one subcategory (or a search) with price, shown-on-quotes and a ⋯ menu each.
const DishTable: React.FC<Props> = ({ crumb, title, group, dishes, showPlace, hasPrice, addTo, fresh, act }) => {
  const [limit, setLimit] = useState(PAGE);
  const [focus, setFocus] = useState<{ id: string; n: number }>({ id: '', n: 0 });
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  useEffect(() => { setLimit(PAGE); }, [title]);

  const add = async () => {
    if (!name.trim()) return;
    await act.add(name.trim(), parseFloat(price) > 0 ? parseFloat(price) : null);
    setName(''); setPrice('');
  };

  return (
    <section className="mb-panel" aria-label={title}>
      <div className="mb-panel-head">
        <div>{crumb && <span className="mb-crumb">{crumb} ›</span>}<h2>{title} <small>· {plural(dishes.length, 'dish', 'dishes')}</small></h2></div>
        {group && <>
          <button type="button" className="ui-btn" onClick={() => act.renameGroup(group)}>Rename</button>
          <button type="button" className="ui-btn" onClick={() => act.shownGroup(group)}>{group.is_active ? 'Hide from quotes' : 'Show on quotes'}</button>
          <DotsMenu label={`More for ${group.name}`} items={[{ label: `Delete ${group.kind === 'cat' ? 'category' : 'subcategory'}…`, danger: true, onClick: () => act.removeGroup(group) }]} />
        </>}
      </div>
      <div className={`mb-tr th`}><span>Dish</span>{hasPrice ? <span>Price / plate</span> : <span />}<span>On quotes</span><span /></div>
      {!dishes.length && <div className="mb-empty">{showPlace ? 'No dishes match.' : 'No dishes here yet. Add one below.'}</div>}
      {dishes.slice(0, limit).map(d => (
        <div key={d.id} id={`dish-${d.id}`} className={`mb-tr${d.is_active ? '' : ' off'}${d.id === fresh ? ' new' : ''}`}>
          <span className="mb-dish">{d.name}{showPlace && <small>{placeOf(d)}</small>}</span>
          {hasPrice ? <PriceBox d={d} onSave={p => act.price(d, p)} focusKey={focus.id === d.id ? focus.n : 0} /> : <span />}
          <Switch label={`${d.name} on quotes`} on={d.is_active} words={['Shown', 'Hidden']} onChange={v => act.shown(d, v)} />
          <DotsMenu label={`More for ${d.name}`} items={[
            { label: 'Edit', strong: true, onClick: () => act.edit(d) },
            ...(hasPrice ? [{ label: 'Set price', onClick: () => setFocus(f => ({ id: d.id, n: f.n + 1 })) }] : []),
            { label: 'Move to…', sep: true, onClick: () => act.move(d) },
            { label: 'Duplicate', onClick: () => act.duplicate(d) },
            { label: d.is_active ? 'Hide from quotes' : 'Show on quotes', onClick: () => act.shown(d, !d.is_active) },
            { label: 'Delete…', sep: true, danger: true, onClick: () => act.remove(d) },
          ]} />
        </div>
      ))}
      {dishes.length > limit && <div className="mb-more"><button type="button" className="ui-btn" onClick={() => setLimit(dishes.length)}>Show all {dishes.length}</button></div>}
      {addTo && (
        <form className="mb-add" onSubmit={e => { e.preventDefault(); add(); }}>
          <input className="dish" value={name} placeholder={`+ Add a dish to ${addTo}`} aria-label={`New dish in ${addTo}`} onChange={e => setName(e.target.value)} />
          {hasPrice && <input className="price" inputMode="decimal" value={price} placeholder="₹ Price" aria-label="Price per plate" onChange={e => setPrice(e.target.value.replace(/[^\d.]/g, ''))} />}
          <button type="submit" className="ui-btn primary" disabled={!name.trim()}>Add</button>
        </form>
      )}
    </section>
  );
};

export default DishTable;
