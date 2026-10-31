import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import SweetsTabs from '../components/SweetsTabs';
import { Navigate, useNavIntent } from '../hooks/useNavIntent';
import {
  useSeasonalItems, useSetItemsActive, useDeleteSeasonalItem, usePackDefaults, useSoldItemIds, SeasonalItem,
} from '../hooks/useSeasonalItems';
import { useSeasonalOccasions } from '../hooks/useSeasonalOccasions';
import { usePackSchema } from '../hooks/useSchemaStatus';
import { planMerge } from '../lib/mergePlan';
import { ALL, andList, sweetChips, sweetGroups } from '../lib/sweetGroups';
import ItemFormModal from '../components/sessional/ItemFormModal';
import BulkPriceModal from '../components/sessional/BulkPriceModal';
import MergeDuplicatesModal from '../components/sessional/MergeDuplicatesModal';
import PackDefaultsModal from '../components/sessional/PackDefaultsModal';
import MigrationBanner from '../components/sessional/MigrationBanner';
import SweetGroupTable, { SweetActions } from '../components/sweets/SweetGroupTable';
import { useConfirm } from '../components/ui/ConfirmDialog';
import '../styles/sweets.css';

type Dialog = { kind: 'form'; item: SeasonalItem | null } | { kind: 'bulk'; items: SeasonalItem[] } | { kind: 'merge'; key?: string } | { kind: 'sizes' } | null;

const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Could not save');

// Sweet items: one line per sweet priced per kg, grouped by occasion, with its POS switch.
const SeasonalItems: React.FC<{ onNavigate?: Navigate }> = ({ onNavigate }) => {
  const intent = useNavIntent('seasonal_items');
  const { data: items = [], isLoading } = useSeasonalItems();
  const { data: occasions = [] } = useSeasonalOccasions(false);
  const { data: soldIds } = useSoldItemIds();
  const legacy = usePackSchema().data === 'legacy';
  const defaults = usePackDefaults();
  const setActive = useSetItemsActive();
  const del = useDeleteSeasonalItem();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const [q, setQ] = useState('');
  const [pick, setPick] = useState(intent?.id ?? ALL);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<Dialog>(null);

  const plans = useMemo(() => (legacy ? [] : planMerge(items, defaults)), [items, defaults, legacy]);
  const chips = useMemo(() => sweetChips(items, occasions), [items, occasions]);
  const current = chips.some(c => c.id === pick) ? pick : ALL;
  const groups = useMemo(() => sweetGroups(items, occasions, current, q), [items, occasions, current, q]);
  const shown = groups.flatMap(g => g.items);
  const selected = shown.filter(i => picked.has(i.id));
  const onPos = items.filter(i => i.is_active).length;

  const toggle = (id: string) => setPicked(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const flip = async (ids: string[], is_active: boolean) => {
    try { await setActive.mutateAsync({ ids, is_active }); toast.success(is_active ? 'Shown on the POS' : 'Hidden from the POS'); }
    catch (e) { toast.error(errorText(e)); }
  };

  const remove = async (i: SeasonalItem) => {
    if (!(await confirm({ title: `Delete ${i.name}?`, message: 'It has never been sold, so nothing else changes.', confirmLabel: 'Delete', danger: true }))) return;
    try { await del.mutateAsync(i.id); toast.success('Deleted'); } catch (e) { toast.error(errorText(e)); }
  };

  const planOf = (i: SeasonalItem) => plans.find(p => p.keepId === i.id || p.removeIds.includes(i.id));
  const act: SweetActions = {
    edit: item => setDialog({ kind: 'form', item }),
    price: item => setDialog({ kind: 'bulk', items: [item] }),
    flip,
    remove,
    mergeable: i => !!planOf(i),
    merge: i => setDialog({ kind: 'merge', key: planOf(i)?.key }),
    sold: i => !soldIds || soldIds.has(i.id),
  };

  return (
    <div className="sw-page">
      <div className="sw-head add-top">
        <div>
          <h1>Sweet items</h1>
          <SweetsTabs current="seasonal_items" onNavigate={onNavigate} />
          <span className="sw-sub sw-desk">{items.length} sweets · {onPos} on the POS · pack prices worked out from the per-kg rate</span>
          <span className="sw-sub sw-phone">{onPos} of {items.length} on the POS</span>
        </div>
        <div className="sw-actions">
          <button type="button" className="ui-btn sw-desk" onClick={() => setDialog({ kind: 'sizes' })}>Pack sizes</button>
          <button type="button" className="ui-btn sw-desk" onClick={() => setDialog({ kind: 'bulk', items: selected.length ? selected : shown })} disabled={!shown.length}>
            Change prices{selected.length ? ` (${selected.length})` : ''}
          </button>
          <button type="button" className="ui-btn primary" onClick={() => setDialog({ kind: 'form', item: null })}>
            <span className="sw-desk">+ Add sweet</span><span className="sw-phone">+ Add</span>
          </button>
        </div>
      </div>

      <div className="sw-bar">
        <div className="sw-chips" role="group" aria-label="Occasion">
          {chips.map(c => (
            <button key={c.id} type="button" aria-pressed={current === c.id} className={`sw-chip${current === c.id ? ' on' : ''}`} onClick={() => setPick(c.id)}>
              {c.label} {c.count}
            </button>
          ))}
        </div>
        <label className="sw-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search sweets" aria-label="Search sweets" />
        </label>
      </div>

      <MigrationBanner />
      {plans.length > 0 && (
        <div className="sw-dupes" role="status">
          <span><b>{plans.length} sweet{plans.length === 1 ? ' looks' : 's look'} saved more than once:</b> {andList(plans.map(p => p.update.name))}. One line per sweet keeps the POS and reports tidy.</span>
          <button type="button" className="ui-btn sw-soft" onClick={() => setDialog({ kind: 'merge' })}>Review and merge</button>
        </div>
      )}

      {selected.length > 0 && (
        <div className="sw-picked" role="status">
          <b>{selected.length} selected</b>
          <button type="button" className="ui-btn" onClick={() => flip(selected.map(i => i.id), true)}>Show on the POS</button>
          <button type="button" className="ui-btn" onClick={() => flip(selected.map(i => i.id), false)}>Hide</button>
          <button type="button" className="ui-btn" onClick={() => setDialog({ kind: 'bulk', items: selected })}>Change prices</button>
          <button type="button" className="ui-btn" onClick={() => setPicked(new Set())}>Clear</button>
        </div>
      )}

      {isLoading ? <div className="sw-empty">Loading…</div>
        : groups.length === 0 ? <div className="sw-empty">{items.length ? 'No sweets match.' : 'No sweets yet. Tap "+ Add sweet" and enter the price per kg.'}</div>
        : groups.map(g => <SweetGroupTable key={g.id} group={g} defaults={defaults} picked={picked} onPick={toggle} act={act} />)}

      {dialog?.kind === 'form' && (
        <ItemFormModal key={dialog.item?.id ?? 'new'} item={dialog.item} items={items} occasions={occasions} defaults={defaults} legacy={legacy}
          onEditOther={item => setDialog({ kind: 'form', item })} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'bulk' && <BulkPriceModal items={dialog.items} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'merge' && <MergeDuplicatesModal plans={dialog.key ? plans.filter(p => p.key === dialog.key) : plans} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'sizes' && <PackDefaultsModal defaults={defaults} legacy={legacy} onClose={() => setDialog(null)} />}
      {confirmDialog}
    </div>
  );
};

export default SeasonalItems;
