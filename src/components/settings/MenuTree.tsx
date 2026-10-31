import React from 'react';
import { CatNode } from '../../lib/menuCatalog';
import '../../styles/settings.css';

interface Props {
  tree: CatNode[];
  openCat: string | null;
  subId: string | null;
  expanded: Set<string>;
  showHidden: boolean;
  onCat: (id: string) => void;
  onSub: (catId: string, subId: string) => void;
  onAddSub: (catId: string) => void;
  onShowHidden: (v: boolean) => void;
}

// Categories down the left, collapsed until opened; an open one lists its subcategories.
const MenuTree: React.FC<Props> = ({ tree, openCat, subId, expanded, showHidden, onCat, onSub, onAddSub, onShowHidden }) => (
  <nav className="mb-tree" aria-label="Categories">
    {!tree.length && <div className="mb-empty">No categories yet.</div>}
    {tree.map(({ cat, count, subs }) => {
      const open = expanded.has(cat.id);
      const shown = cat.id === openCat && !subId;
      return (
        <React.Fragment key={cat.id}>
          <button type="button" className={`mb-node cat${open ? ' open' : ''}${shown ? ' on' : ''}${cat.is_active ? '' : ' hidden'}`} aria-expanded={open} aria-current={shown ? 'true' : undefined} onClick={() => onCat(cat.id)}>
            <i aria-hidden="true">{open ? '▾' : '▸'}</i><span>{cat.name}</span><span className="mb-count">{count}</span>
          </button>
          {open && subs.map(({ sub, count: n }) => (
            <button key={sub.id} type="button" className={`mb-node sub${sub.id === subId ? ' on' : ''}${sub.is_active ? '' : ' hidden'}`}
              aria-current={sub.id === subId ? 'true' : undefined} onClick={() => onSub(cat.id, sub.id)}>
              <span>{sub.name}</span><span className="mb-count">{n}</span>
            </button>
          ))}
          {open && <button type="button" className="mb-node add" onClick={() => onAddSub(cat.id)}>+ Subcategory</button>}
        </React.Fragment>
      );
    })}
    <div className="mb-tree-foot">
      <label className="pk-check"><input type="checkbox" checked={showHidden} onChange={e => onShowHidden(e.target.checked)} /> Show hidden dishes</label>
    </div>
  </nav>
);

export default MenuTree;
