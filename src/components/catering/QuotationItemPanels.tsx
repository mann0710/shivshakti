import React, { useMemo, useState } from 'react';
import { QuotationLineItem } from '../../hooks/useQuotations';
import { choiceGroups, setGroupMeta, assignGroup, ungroup, newChoiceId, plateRange } from '../../lib/quoteChoices';
import QuotationChoiceGroup from './QuotationChoiceGroup';

export interface PickerItem {
  id: string;
  name: string;
  default_price?: number | null;
  subcategory?: { name: string; category?: { name: string } | null } | null;
}

export type ItemTextField = 'instruction' | 'served_with';

interface Props {
  menuItems: PickerItem[];
  items: QuotationLineItem[];
  onAdd: (it: PickerItem) => void;
  onAmount: (itemId: string, amount: number) => void;
  onRemove: (itemId: string) => void;
  onText: (itemId: string, field: ItemTextField, value: string) => void;
  onReorder: (from: number, to: number) => void;
  onReset: () => void;
  selectedTitle: string;
  totalLabel: string;
  compact?: boolean;
  showPrices?: boolean;
  // Whole-list changes for "choose any" groups; omit to hide them.
  onChoice?: (next: QuotationLineItem[]) => void;
}

type Group = { subcategory: string; items: PickerItem[] };

// Available menu items (searchable, grouped by category) beside the chosen items with prices.
const QuotationItemPanels: React.FC<Props> = ({
  menuItems, items, onAdd, onAmount, onRemove, onText, onReorder, onReset, selectedTitle, totalLabel, compact, showPrices = true, onChoice,
}) => {
  const [picking, setPicking] = useState<Set<string> | null>(null);
  const groups = choiceGroups(items);
  const [search, setSearch] = useState('');
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const fs = compact ? 12 : 13;
  const maxHeight = compact ? 240 : 300;

  const grouped = useMemo(() => {
    const chosen = new Set(items.map(i => i.item_id));
    const q = search.trim().toLowerCase();
    const map: Record<string, Group[]> = {};
    menuItems.forEach(it => {
      if (chosen.has(it.id)) return;
      if (q && !(it.name.toLowerCase().includes(q)
        || it.subcategory?.name.toLowerCase().includes(q)
        || it.subcategory?.category?.name.toLowerCase().includes(q))) return;
      const cat = it.subcategory?.category?.name || 'Uncategorised';
      const sub = it.subcategory?.name || 'General';
      if (!map[cat]) map[cat] = [];
      let sg = map[cat].find(g => g.subcategory === sub);
      if (!sg) { sg = { subcategory: sub, items: [] }; map[cat].push(sg); }
      sg.items.push(it);
    });
    return map;
  }, [menuItems, items, search]);

  const total = plateRange(items);
  const endDrag = () => { setDragIdx(null); setOverIdx(null); };

  const textInput = (it: QuotationLineItem, field: ItemTextField, placeholder: string, on: string, ink: string) => (
    <input draggable={false} placeholder={placeholder} value={it[field] || ''}
      onChange={e => onText(it.item_id, field, e.target.value)}
      style={{ flex: 1, minWidth: 0, border: 'none', borderBottom: `1px dashed ${it[field] ? on : '#E0E0DC'}`, fontSize: 11, color: it[field] ? ink : '#AAAAAA', padding: '1px 2px', background: 'transparent', outline: 'none', boxSizing: 'border-box' }} />
  );

  const togglePick = (id: string) => setPicking(prev => {
    const next = new Set(prev ?? []);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  // Ticked dishes become one "choose any 1" group named after their course.
  const makeGroup = () => {
    if (!picking || picking.size < 2) return;
    const first = items.find(i => picking.has(i.item_id));
    const meta = { id: newChoiceId(), label: first?.subcategory_name || first?.category_name || 'Choose any', pick: 1 };
    onChoice?.(items.map(i => (picking.has(i.item_id) ? { ...i, choice: meta, chosen: undefined } : i)));
    setPicking(null);
  };

  const row = (it: QuotationLineItem, idx: number) => (
            <div key={it.item_id}
              draggable
              onDragStart={e => { setDragIdx(idx); e.dataTransfer.effectAllowed = 'move'; }}
              onDragEnd={endDrag}
              onDragOver={e => { e.preventDefault(); if (overIdx !== idx) setOverIdx(idx); }}
              onDrop={e => { e.preventDefault(); if (dragIdx !== null && dragIdx !== idx) onReorder(dragIdx, idx); endDrag(); }}
              style={{
                opacity: dragIdx === idx ? 0.35 : 1,
                borderTop: overIdx === idx && dragIdx !== idx ? '2px solid #E8750A' : '2px solid transparent',
                transition: 'border-top-color 0.1s',
                borderBottom: '0.5px solid #F5F5F0',
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px 3px 8px' }}>
                {picking && !it.choice
                  ? <input type="checkbox" aria-label={`Put ${it.item_name} in the group`} checked={picking.has(it.item_id)} onChange={() => togglePick(it.item_id)} style={{ width: 16, height: 16, accentColor: '#E8750A' }} />
                  : <span title="Drag to reorder" style={{ cursor: 'grab', color: '#CCCCCA', fontSize: 15, userSelect: 'none', flexShrink: 0 }}>⠿</span>}
                <span style={{ fontSize: fs, flex: 1 }}>{it.item_name}</span>
                {it.subcategory_name && <span className="hide-sm" style={{ fontSize: 10, color: '#AAAAAA', whiteSpace: 'nowrap' }}>{it.subcategory_name}</span>}
                {showPrices && <>
                  <span style={{ fontSize: 12, color: '#888880' }}>₹</span>
                  <input type="number" min="0" inputMode="decimal" value={it.amount || ''} placeholder="0"
                    onChange={e => onAmount(it.item_id, parseFloat(e.target.value) || 0)}
                    style={{ width: 76, border: '1px solid #E5E5E0', borderRadius: 6, padding: '4px 6px', fontSize: fs, textAlign: 'right' }} />
                </>}
                {it.choice && onChoice && <button type="button" onClick={() => onChoice(assignGroup(items, it.item_id, null))} title="Move out of the group" style={{ fontSize: 11, color: '#888880', background: 'none', border: 'none', cursor: 'pointer' }}>↩</button>}
                <button onClick={() => onRemove(it.item_id)} aria-label="Remove item"
                  style={{ background: 'none', border: 'none', color: '#CC4444', fontSize: 16, cursor: 'pointer', padding: '0 2px' }}>×</button>
              </div>
              <div style={{ paddingLeft: 28, paddingRight: 12, paddingBottom: 4, display: 'flex', gap: 10 }}>
                {textInput(it, 'instruction', 'Add instruction (optional)…', '#E8750A', '#7A4F20')}
                {textInput(it, 'served_with', 'Served with (optional)…', '#2E7D32', '#1B5E20')}
              </div>
            </div>
  );

  return (
    <div className="quotation-panels" style={{ marginTop: compact ? 0 : 4 }}>
      {/* LEFT — available */}
      <div style={box}>
        <div style={{ padding: '8px 12px', borderBottom: '0.5px solid #E5E5E0', background: '#F9F8F5' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#444', marginBottom: 5 }}>AVAILABLE ITEMS</div>
          <input placeholder="Search items…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', border: '1px solid #E5E5E0', borderRadius: 6, padding: '6px 8px', fontSize: 12, boxSizing: 'border-box' }} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', maxHeight, padding: '6px 0' }}>
          {Object.keys(grouped).length === 0 ? (
            <div style={{ padding: '20px 12px', textAlign: 'center', color: '#AAAAAA', fontSize: 12 }}>
              {menuItems.length === 0 ? 'No active menu items' : search ? 'No items match' : 'All items selected'}
            </div>
          ) : Object.entries(grouped).map(([cat, subs]) => (
            <div key={cat}>
              <div style={{ padding: '6px 12px 2px', fontSize: 10, fontWeight: 700, color: '#E8750A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{cat}</div>
              {subs.map(sg => (
                <div key={sg.subcategory}>
                  <div style={{ padding: '3px 12px 2px 18px', fontSize: 10, fontWeight: 600, color: '#888880', textTransform: 'uppercase' }}>{sg.subcategory}</div>
                  {sg.items.map(it => (
                    <button key={it.id} type="button" onClick={() => onAdd(it)} title="Add item"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%', padding: '5px 12px 5px 24px', cursor: 'pointer', background: 'transparent', border: 'none', textAlign: 'left', color: 'inherit' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F5F5F0')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <span style={{ fontSize: fs, flex: 1 }}>{it.name}</span>
                      {showPrices && !!it.default_price && <span style={{ fontSize: 11, color: '#888880' }}>₹{it.default_price.toLocaleString('en-IN')}</span>}
                      <span style={{ background: '#E8750A', color: '#fff', borderRadius: 5, width: 22, height: 22, fontSize: 14, lineHeight: '22px', textAlign: 'center', flexShrink: 0 }}>+</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT — selected */}
      <div style={box}>
        <div style={{ padding: '8px 12px', borderBottom: '0.5px solid #E5E5E0', background: '#F9F8F5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#444' }}>{selectedTitle}</span>
          {onChoice && items.filter(i => !i.choice).length >= 2 && (picking
            ? <span style={{ display: 'flex', gap: 6, marginLeft: 'auto', marginRight: 6 }}>
                <button type="button" onClick={makeGroup} disabled={picking.size < 2} style={{ ...chipBtn, background: '#E8750A', color: '#fff', borderColor: '#E8750A', opacity: picking.size < 2 ? 0.5 : 1 }}>Group {picking.size} dishes</button>
                <button type="button" onClick={() => setPicking(null)} style={chipBtn}>Cancel</button>
              </span>
            : <button type="button" onClick={() => setPicking(new Set())} title="Customer chooses some of these dishes" style={{ ...chipBtn, marginLeft: 'auto', marginRight: 6, color: '#A84F00', borderColor: '#E8A867' }}>+ Choose-any group</button>)}
          {items.length > 0 && (
            <button onClick={onReset} style={{ fontSize: 11, color: '#CC4444', background: 'none', border: '1px solid #CC4444', borderRadius: 5, padding: '2px 8px', cursor: 'pointer' }}>Reset all</button>
          )}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', maxHeight, padding: '4px 0' }}>
          {items.length === 0 ? (
            <div style={{ padding: '36px 12px', textAlign: 'center', color: '#AAAAAA', fontSize: 12 }}>Tap an item on the left to add it</div>
          ) : (<>
            {items.map((it, idx) => (it.choice ? null : row(it, idx)))}
            {groups.map(g => (
              <QuotationChoiceGroup key={g.meta.id} group={g} showPrices={showPrices}
                onMeta={patch => onChoice?.(setGroupMeta(items, g.meta.id, patch))}
                onUngroup={() => onChoice?.(ungroup(items, g.meta.id))}>
                {items.map((it, idx) => (it.choice?.id === g.meta.id ? row(it, idx) : null))}
              </QuotationChoiceGroup>
            ))}
          </>)}
        </div>
        {showPrices && items.length > 0 && (
          <div style={{ borderTop: '0.5px solid #E5E5E0', padding: '6px 12px', background: '#F9F8F5', display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#666' }}>
            <span>{totalLabel}</span>
            <span style={{ fontWeight: 600 }}>₹{total.min.toLocaleString('en-IN')}{total.max > total.min ? ` – ₹${total.max.toLocaleString('en-IN')}` : ''}</span>
          </div>
        )}
      </div>
    </div>
  );
};

const chipBtn: React.CSSProperties = { fontSize: 11, padding: '2px 8px', borderRadius: 5, border: '1px solid #D0D0CC', background: '#fff', cursor: 'pointer' };
const box: React.CSSProperties = { border: '0.5px solid #E5E5E0', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#fff' };

export default QuotationItemPanels;
