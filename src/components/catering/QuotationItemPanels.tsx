import React, { useMemo, useState } from 'react';
import { QuotationLineItem } from '../../hooks/useQuotations';
import { choiceGroups, setGroupMeta, ungroup, plateRange, addAlternative, togglePicked, tidyGroups } from '../../lib/quoteChoices';
import QuotationChoiceGroup from './QuotationChoiceGroup';
import AlternativePicker from './AlternativePicker';
import ServedWithPicker from './ServedWithPicker';

export interface PickerItem {
  id: string;
  name: string;
  default_price?: number | null;
  subcategory?: { name: string; category?: { name: string } | null } | null;
}


interface Props {
  menuItems: PickerItem[];
  items: QuotationLineItem[];
  onAdd: (it: PickerItem) => void;
  onAmount: (itemId: string, amount: number) => void;
  onRemove: (itemId: string) => void;
  onPatch: (itemId: string, change: Partial<QuotationLineItem>) => void;
  onReorder: (from: number, to: number) => void;
  onReset: () => void;
  selectedTitle: string;
  totalLabel: string;
  compact?: boolean;
  showPrices?: boolean;
  // Whole-list changes for alternatives ("customer chooses"); omit to hide them.
  onChoice?: (next: QuotationLineItem[]) => void;
  toLine?: (it: PickerItem) => QuotationLineItem;
}

type AltTarget = { itemId?: string; groupId?: string; name: string; course: string };

type Group = { subcategory: string; items: PickerItem[] };

// Available menu items (searchable, grouped by category) beside the chosen items with prices.
const QuotationItemPanels: React.FC<Props> = ({
  menuItems, items, onAdd, onAmount, onRemove, onPatch, onReorder, onReset, selectedTitle, totalLabel, compact, showPrices = true, onChoice, toLine,
}) => {
  const [altFor, setAltFor] = useState<AltTarget | null>(null);
  const canAlt = !!onChoice && !!toLine;
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

  const noteInput = (it: QuotationLineItem) => (
    <input draggable={false} placeholder="Add instruction (optional)…" value={it.instruction || ''}
      onChange={e => onPatch(it.item_id, { instruction: e.target.value })}
      style={{ flex: 1, minWidth: 0, alignSelf: 'flex-start', border: 'none', borderBottom: `1px dashed ${it.instruction ? '#E8750A' : '#E0E0DC'}`, fontSize: 11, color: it.instruction ? '#7A4F20' : '#AAAAAA', padding: '1px 2px', background: 'transparent', outline: 'none', boxSizing: 'border-box' }} />
  );

  const pickAlt = ({ menu, existing }: { menu?: PickerItem; existing?: QuotationLineItem }) => {
    const alt = existing ?? (menu && toLine?.(menu));
    if (!alt || !altFor || !onChoice) return;
    onChoice(addAlternative(items, altFor.groupId ? { groupId: altFor.groupId } : { itemId: altFor.itemId }, alt));
    setAltFor(null);
  };
  // Removing a dish from a choice keeps the rest tidy (a lone dish is no longer a choice).
  const remove = (it: QuotationLineItem) => (it.choice && onChoice ? onChoice(tidyGroups(items.filter(i => i.item_id !== it.item_id))) : onRemove(it.item_id));
  const picker = (t: AltTarget) => (
    <AlternativePicker forName={t.name} course={t.course} menuItems={menuItems} items={items} showPrices={showPrices} onPick={pickAlt} onClose={() => setAltFor(null)} />
  );

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
                {it.choice && onChoice
                  ? <button type="button" aria-pressed={!!it.chosen} onClick={() => onChoice(togglePicked(items, it.item_id))} title="Tick when the customer picks this"
                      style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 12, cursor: 'pointer', border: `1px solid ${it.chosen ? '#3B6D11' : '#D0D0CC'}`, background: it.chosen ? '#EBF4E1' : '#fff', color: it.chosen ? '#2F5A0E' : '#888880' }}>
                      {it.chosen ? '✓ Picked' : 'Picked?'}</button>
                  : <span title="Drag to reorder" style={{ cursor: 'grab', color: '#CCCCCA', fontSize: 15, userSelect: 'none', flexShrink: 0 }}>⠿</span>}
                <span style={{ fontSize: fs, flex: 1 }}>{it.item_name}</span>
                {it.subcategory_name && <span className="hide-sm" style={{ fontSize: 10, color: '#AAAAAA', whiteSpace: 'nowrap' }}>{it.subcategory_name}</span>}
                {showPrices && <>
                  <span style={{ fontSize: 12, color: '#888880' }}>₹</span>
                  <input type="number" min="0" inputMode="decimal" value={it.amount || ''} placeholder="0"
                    onChange={e => onAmount(it.item_id, parseFloat(e.target.value) || 0)}
                    style={{ width: 76, border: '1px solid #E5E5E0', borderRadius: 6, padding: '4px 6px', fontSize: fs, textAlign: 'right' }} />
                </>}
                {canAlt && !it.choice && (
                  <button type="button" onClick={() => setAltFor({ itemId: it.item_id, name: it.item_name, course: it.subcategory_name })} title={`Let the customer choose something instead of ${it.item_name}`}
                    style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, color: '#A84F00', background: '#FFF6EA', border: '1px solid #F2C77E', borderRadius: 12, padding: '3px 9px', cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Alternative</button>
                )}
                <button onClick={() => remove(it)} aria-label="Remove item"
                  style={{ background: 'none', border: 'none', color: '#CC4444', fontSize: 16, cursor: 'pointer', padding: '0 2px' }}>×</button>
              </div>
              <div draggable={false} onDragStart={e => e.preventDefault()} style={{ paddingLeft: 28, paddingRight: 12, paddingBottom: 4, display: 'flex', flexWrap: 'wrap', gap: '4px 10px' }}>
                {noteInput(it)}
                <ServedWithPicker item={it} menuItems={menuItems} onChange={change => onPatch(it.item_id, change)} />
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
          {items.length > 0 && (
            <button onClick={onReset} style={{ fontSize: 11, color: '#CC4444', background: 'none', border: '1px solid #CC4444', borderRadius: 5, padding: '2px 8px', cursor: 'pointer' }}>Reset all</button>
          )}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', maxHeight, padding: '4px 0' }}>
          {items.length === 0 ? (
            <div style={{ padding: '36px 12px', textAlign: 'center', color: '#AAAAAA', fontSize: 12 }}>Tap an item on the left to add it</div>
          ) : items.map((it, idx) => {
            // Plain dish (with its alternative search), or the choice box where its first dish sits.
            if (!it.choice) return <React.Fragment key={it.item_id}>{row(it, idx)}{altFor?.itemId === it.item_id && picker(altFor)}</React.Fragment>;
            const g = groups.find(x => x.meta.id === it.choice!.id)!;
            if (g.items[0].item_id !== it.item_id) return null;
            return (
              <React.Fragment key={g.meta.id}>
                <QuotationChoiceGroup group={g} showPrices={showPrices}
                  rows={items.map((x, i) => (x.choice?.id === g.meta.id ? row(x, i) : null)).filter(Boolean)}
                  onMeta={patch => onChoice?.(setGroupMeta(items, g.meta.id, patch))}
                  onUngroup={() => onChoice?.(ungroup(items, g.meta.id))}
                  onAddAlternative={() => setAltFor({ groupId: g.meta.id, name: g.items.map(x => x.item_name).join(' / '), course: g.items[0].subcategory_name })} />
                {altFor?.groupId === g.meta.id && picker(altFor)}
              </React.Fragment>
            );
          })}
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

const box: React.CSSProperties = { border: '0.5px solid #E5E5E0', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#fff' };

export default QuotationItemPanels;
