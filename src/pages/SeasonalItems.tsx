import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  useSeasonalItems, useSetItemsActive, useDeleteSeasonalItem, usePackDefaults, SeasonalItem,
} from '../hooks/useSeasonalItems';
import { useSeasonalOccasions } from '../hooks/useSeasonalOccasions';
import { usePackSchema } from '../hooks/useSchemaStatus';
import { itemPacks } from '../lib/itemCatalog';
import { planMerge } from '../lib/mergePlan';
import { rateLabel } from '../lib/units';
import { inr } from '../lib/money';
import ItemFormModal from '../components/sessional/ItemFormModal';
import BulkPriceModal from '../components/sessional/BulkPriceModal';
import MergeDuplicatesModal from '../components/sessional/MergeDuplicatesModal';
import PackDefaultsModal from '../components/sessional/PackDefaultsModal';
import MigrationBanner from '../components/sessional/MigrationBanner';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { btnPrimary, btnGhost, btnSm, inp, th, td, empty, pill, NAVY, DANGER, SUCCESS } from '../components/ui/styles';

type Status = 'active' | 'inactive' | 'all';
type Dialog = { kind: 'form'; item: SeasonalItem | null } | { kind: 'bulk' } | { kind: 'merge' } | { kind: 'sizes' } | null;

// Catalog of sweets: one row per item, priced per kg / litre / piece, packs calculated automatically.
const SeasonalItems: React.FC = () => {
  const { data: items = [], isLoading } = useSeasonalItems();
  const { data: occasions = [] } = useSeasonalOccasions(false);
  const legacy = usePackSchema().data === 'legacy';
  const defaults = usePackDefaults();
  const setActive = useSetItemsActive();
  const del = useDeleteSeasonalItem();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const [q, setQ] = useState('');
  const [occ, setOcc] = useState('');
  const [cat, setCat] = useState('');
  const [status, setStatus] = useState<Status>('all');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<Dialog>(null);

  const occName = (id?: string | null) => occasions.find(o => o.id === id)?.name;
  const categories = useMemo(() => Array.from(new Set(items.map(i => i.category).filter(Boolean) as string[])).sort(), [items]);
  const plans = useMemo(() => (legacy ? [] : planMerge(items, defaults)), [items, defaults, legacy]);
  const dupRows = plans.reduce((s, p) => s + p.removeIds.length, 0);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter(i =>
      (!term || i.name.toLowerCase().includes(term) || (i.category ?? '').toLowerCase().includes(term))
      && (!occ || (occ === 'none' ? !i.occasion_id : i.occasion_id === occ))
      && (!cat || i.category === cat)
      && (status === 'all' || (status === 'active') === i.is_active));
  }, [items, q, occ, cat, status]);

  const selected = shown.filter(i => picked.has(i.id));
  const allPicked = shown.length > 0 && selected.length === shown.length;
  const toggle = (id: string) => setPicked(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const flip = async (ids: string[], is_active: boolean) => {
    try { await setActive.mutateAsync({ ids, is_active }); toast.success(is_active ? 'Activated' : 'Deactivated'); }
    catch (e: any) { toast.error(e.message); }
  };

  const remove = async (i: SeasonalItem) => {
    if (!(await confirm({ title: `Delete ${i.name}?`, message: 'Old bills keep their copy of the item. Deactivate instead if you may sell it again.', confirmLabel: 'Delete', danger: true }))) return;
    try { await del.mutateAsync(i.id); toast.success('Deleted'); } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div>
      <div className="page-topbar">
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Sessional Items</div>
          <div style={{ fontSize: 11, color: '#888880', marginTop: 2 }}>
            {items.filter(i => i.is_active).length} active · {items.filter(i => !i.is_active).length} inactive · packs priced from the per-kg rate
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button style={btnGhost} onClick={() => setDialog({ kind: 'sizes' })}>⚖ Pack sizes</button>
          <button style={btnGhost} onClick={() => setDialog({ kind: 'bulk' })} disabled={!shown.length}>
            ₹ Change prices{selected.length ? ` (${selected.length})` : ''}
          </button>
          <button style={btnPrimary} onClick={() => setDialog({ kind: 'form', item: null })}>+ Add item</button>
        </div>
      </div>

      <div className="page-content">
        <MigrationBanner />
        {plans.length > 0 && (
          <div style={{ background: '#EEF0FB', border: '1px solid #C5CAF5', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ flex: 1, minWidth: 220 }}>
              🧹 <b>{plans.length} item{plans.length === 1 ? '' : 's'}</b> are saved as separate pack rows{dupRows ? ` (${dupRows} duplicate row${dupRows === 1 ? '' : 's'})` : ''}. Clean them up into one per-kg item each, keeping every price.
            </span>
            <button style={btnPrimary} onClick={() => setDialog({ kind: 'merge' })}>Review &amp; merge</button>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <input style={{ ...inp, flex: '1 1 200px', width: 'auto' }} value={q} onChange={e => setQ(e.target.value)} placeholder="Search items or categories" />
          <select style={{ ...inp, width: 'auto' }} value={occ} onChange={e => setOcc(e.target.value)} aria-label="Occasion">
            <option value="">All occasions</option>
            <option value="none">All-year items</option>
            {occasions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          {categories.length > 0 && (
            <select style={{ ...inp, width: 'auto' }} value={cat} onChange={e => setCat(e.target.value)} aria-label="Category">
              <option value="">All categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          <select style={{ ...inp, width: 'auto' }} value={status} onChange={e => setStatus(e.target.value as Status)} aria-label="Status">
            <option value="all">Active + inactive</option><option value="active">Active</option><option value="inactive">Inactive</option>
          </select>
        </div>

        {/* Always rendered so ticking a box doesn't shift the table */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, fontSize: 12, minHeight: 28, color: '#888880' }}>
          {selected.length > 0 ? (
            <>
              <b style={{ color: '#1A1A18' }}>{selected.length} selected</b>
              <button style={btnSm} onClick={() => flip(selected.map(i => i.id), true)}>Activate</button>
              <button style={btnSm} onClick={() => flip(selected.map(i => i.id), false)}>Deactivate</button>
              <button style={btnSm} onClick={() => setPicked(new Set())}>Clear</button>
            </>
          ) : 'Tick items to activate, deactivate or change prices together.'}
        </div>

        {isLoading ? <div style={empty}>Loading…</div> : shown.length === 0 ? (
          <div style={empty}>{items.length ? 'No items match these filters.' : 'No items yet. Click "+ Add item" and enter the price per kg.'}</div>
        ) : (
          <div className="table-wrap" style={{ background: '#fff', border: '0.5px solid #E5E5E0', borderRadius: 12 }}>
            <table className="stack-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 720 }}>
              <thead>
                <tr style={{ background: '#F9F8F5', borderBottom: '0.5px solid #E5E5E0' }}>
                  <th style={{ ...th, width: 32 }}><input type="checkbox" aria-label="Select all" checked={allPicked} onChange={() => setPicked(allPicked ? new Set() : new Set(shown.map(i => i.id)))} /></th>
                  <th style={th}>Item</th><th style={th}>Price</th><th style={th}>Packs (auto)</th><th style={th}>Occasion</th><th style={th}>Status</th>
                  <th style={{ ...th, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(i => (
                  <tr key={i.id} style={{ borderBottom: '0.5px solid #F0F0EC', opacity: i.is_active ? 1 : 0.55 }}>
                    <td style={td}><input type="checkbox" aria-label={`Select ${i.name}`} checked={picked.has(i.id)} onChange={() => toggle(i.id)} /></td>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{i.name}</div>
                      {i.category && <div style={{ fontSize: 11, color: '#888880' }}>{i.category}</div>}
                    </td>
                    <td data-label="Price" style={{ ...td, fontWeight: 600, whiteSpace: 'nowrap' }}>{rateLabel(i.rate, i.unit)}</td>
                    <td style={td}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {itemPacks(i, defaults).map(p => (
                          <span key={p.size} style={pill(p.manual ? '#FFF3E0' : '#EEF0FB', p.manual ? '#B26A00' : NAVY)}>{p.label} {inr(p.price)}</span>
                        ))}
                      </div>
                    </td>
                    <td data-label="Occasion" style={td}>{occName(i.occasion_id) ? <span style={pill('#EEF0FB', NAVY)}>{occName(i.occasion_id)}</span> : <span style={{ color: '#AAAAAA', fontSize: 12 }}>All year</span>}</td>
                    <td style={td}><span style={pill(i.is_active ? '#EAF3DE' : '#F5F5F0', i.is_active ? SUCCESS : '#888880')}>{i.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button style={btnSm} onClick={() => setDialog({ kind: 'form', item: i })}>Edit</button>{' '}
                      <button style={btnSm} onClick={() => flip([i.id], !i.is_active)}>{i.is_active ? 'Deactivate' : 'Activate'}</button>{' '}
                      <button style={{ ...btnSm, color: DANGER }} onClick={() => remove(i)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {dialog?.kind === 'form' && (
        <ItemFormModal key={dialog.item?.id ?? 'new'} item={dialog.item} items={items} occasions={occasions} defaults={defaults} legacy={legacy}
          onEditOther={item => setDialog({ kind: 'form', item })} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'bulk' && <BulkPriceModal items={selected.length ? selected : shown} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'merge' && <MergeDuplicatesModal plans={plans} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'sizes' && <PackDefaultsModal defaults={defaults} legacy={legacy} onClose={() => setDialog(null)} />}
      {confirmDialog}
    </div>
  );
};

export default SeasonalItems;
