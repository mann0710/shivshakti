import React, { useMemo, useState } from 'react';
import { useMenus } from '../hooks/useMenus';
import { useMenuCategories, useMenuItemsFull, useMenuSubcategories } from '../hooks/useMenuBuilder';
import { useBookings } from '../hooks/useBookings';
import { useConfirm } from '../components/ui/ConfirmDialog';
import PackageEditor from '../components/settings/PackageEditor';
import { buildTree, groupsOf, placesByName, plateRow, plateSummary, plural } from '../lib/menuCatalog';
import { todayIST } from '../lib/ist';
import { priceSpan, sampleBooking } from '../lib/priceTiers';
import { range } from '../lib/quoteSummary';
import '../styles/settings.css';

// Ready-made plates with a fixed price: the list on the left, the picked one open on the right.
const Menus: React.FC = () => {
  const { data: menus = [], isLoading } = useMenus(true);
  const { data: dishes = [] } = useMenuItemsFull();
  const { data: cats = [] } = useMenuCategories();
  const { data: subs = [] } = useMenuSubcategories();
  const { data: bookings = [] } = useBookings();
  const { confirm, dialog } = useConfirm();
  const [showHidden, setShowHidden] = useState(false);
  const [picked, setPicked] = useState<string | 'new' | null>(null);
  const [dirty, setDirty] = useState(false);

  const places = useMemo(() => placesByName(dishes), [dishes]);
  const groups = useMemo(() => groupsOf(buildTree(cats, subs, dishes)), [cats, subs, dishes]);
  const suggestions = useMemo(() => Array.from(new Set([...groups.map(g => g.name), ...dishes.filter(d => d.is_active).map(d => d.name)])), [groups, dishes]);
  const used = useMemo(() => {
    const m = new Map<string, number>();
    bookings.forEach(b => { if (b.menu_id && b.status !== 'cancelled') m.set(b.menu_id, (m.get(b.menu_id) ?? 0) + 1); });
    return m;
  }, [bookings]);
  const list = menus.filter(m => showHidden || m.is_active || m.id === picked);
  const current = picked === 'new' ? undefined : menus.find(m => m.id === picked) ?? list[0];
  const editingNew = picked === 'new' || (!current && !isLoading);
  const sample = useMemo(() => sampleBooking(bookings, editingNew ? undefined : current?.id, todayIST()), [bookings, editingNew, current?.id]);

  const pick = async (id: string | 'new') => {
    if (id === picked) return;
    if (dirty && !(await confirm({ title: 'Throw away your changes?', message: 'The package you are editing has changes that are not saved.', confirmLabel: 'Throw away', danger: true }))) return;
    setDirty(false);
    setPicked(id);
  };

  return (
    <div className="pk-page">
      <div className="pk-head">
        <div>
          <h1>Packages</h1>
          <p>Ready-made plates with a fixed price · start a quotation from one in a tap</p>
        </div>
        <button type="button" className="ui-btn primary" onClick={() => pick('new')}>+ New package</button>
      </div>

      <div className="pk-layout">
        <div className="pk-list">
          {isLoading && <div className="mb-empty">Loading packages…</div>}
          {list.map(m => {
            const rows = (m.items ?? []).map(t => plateRow(t, places, groups));
            const span = priceSpan(m);
            return (
              <button key={m.id} type="button" className={`pk-card${m.id === current?.id && !editingNew ? ' on' : ''}${m.is_active ? '' : ' off'}`} onClick={() => pick(m.id)}>
                <span className="pk-card-top"><b>{m.name}</b><span className="pk-price">{range(span.low, span.high)} <small>/ plate</small></span></span>
                <span>{m.category} · {plateSummary(rows)}</span>
                <small className="muted">{m.is_active ? `Used in ${plural(used.get(m.id) ?? 0, 'booking')}` : 'Hidden from quotes and bookings'}</small>
              </button>
            );
          })}
          {picked === 'new' && <div className="pk-card on"><span className="pk-card-top"><b>New package</b></span><small className="muted">Not saved yet</small></div>}
          <label className="pk-check"><input type="checkbox" checked={showHidden} onChange={e => setShowHidden(e.target.checked)} /> Show hidden packages</label>
        </div>

        {(current || editingNew) && (
          <PackageEditor key={editingNew ? 'new' : current!.id} menu={editingNew ? undefined : current} places={places} groups={groups} suggestions={suggestions}
            takenNames={menus.map(m => m.name)} sample={sample} onDirty={setDirty} onSaved={id => { setDirty(false); setPicked(id); }} />
        )}
      </div>
      {dialog}
    </div>
  );
};

export default Menus;
