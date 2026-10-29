import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import SizeChips from './SizeChips';
import { SeasonalItem, ItemInput, toInput, nameKey, baseName, hasWeightToken } from '../../lib/itemCatalog';
import { PriceUnit, PackDefaults, UNITS, UNIT_NAMES, buildPacks, formatSize } from '../../lib/units';
import { inr } from '../../lib/money';
import { SeasonalOccasion } from '../../hooks/useSeasonalOccasions';
import { useSaveSeasonalItem } from '../../hooks/useSeasonalItems';
import { inp, lbl, btnPrimary, btnGhost, btnSm, segBtn, segWrap, fieldWrap, NAVY } from '../ui/styles';

interface Props {
  item: SeasonalItem | null;
  items: SeasonalItem[];
  occasions: SeasonalOccasion[];
  defaults: PackDefaults;
  legacy: boolean;
  onEditOther: (item: SeasonalItem) => void;
  onClose: () => void;
}

const blank = (): ItemInput => ({ name: '', unit: 'kg', rate: 0, pack_sizes: null, pack_prices: null, category: null, occasion_id: null, is_active: true });

// Add / edit one sweet: a rate per kg (or litre / piece); pack prices are calculated from it.
const ItemFormModal: React.FC<Props> = ({ item, items, occasions, defaults, legacy, onEditOther, onClose }) => {
  const save = useSaveSeasonalItem();
  const [f, setF] = useState<ItemInput>(() => (item ? toInput(item) : blank()));
  const [rateText, setRateText] = useState(item ? String(item.rate) : '');
  const set = (patch: Partial<ItemInput>) => setF(prev => ({ ...prev, ...patch }));
  const rate = Number(rateText) || 0;
  const ownSizes = f.pack_sizes !== null;
  const unitInfo = UNITS[f.unit];

  const packs = useMemo(() => buildPacks(rate, f.unit, f.pack_sizes, f.pack_prices, defaults), [rate, f.unit, f.pack_sizes, f.pack_prices, defaults]);
  const categories = useMemo(() => Array.from(new Set(items.map(i => i.category).filter(Boolean) as string[])).sort(), [items]);
  const twin = items.find(i => i.id !== item?.id && f.name.trim() && nameKey(i.name) === nameKey(f.name)
    && i.unit === f.unit && (i.occasion_id ?? '') === (f.occasion_id ?? ''));

  const setUnit = (unit: PriceUnit) => set({ unit, pack_sizes: null, pack_prices: null });
  const setManual = (size: number, value: string) => {
    const next = { ...(f.pack_prices ?? {}) };
    if (value === '') delete next[String(size)]; else next[String(size)] = Number(value);
    set({ pack_prices: Object.keys(next).length ? next : null });
  };

  const submit = async () => {
    if (!f.name.trim()) { toast.error('Item name is required'); return; }
    if (rate <= 0) { toast.error(`Enter the price per ${unitInfo.label}`); return; }
    if (twin && !item) { toast.error(`"${twin.name}" already exists. Edit it instead of adding a duplicate.`); return; }
    if (ownSizes && !f.pack_sizes!.length) { toast.error('Add at least one pack size'); return; }
    try {
      await save.mutateAsync({ id: item?.id, input: { ...f, rate } });
      toast.success(item ? 'Item updated' : 'Item added');
      onClose();
    } catch (e: any) { toast.error(e.message || 'Could not save'); }
  };

  return (
    <Modal title={item ? `Edit ${item.name}` : 'New item'} onClose={onClose} width={560}
      footer={<>
        <button style={btnGhost} onClick={onClose}>Cancel</button>
        <button style={btnPrimary} onClick={submit} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save item'}</button>
      </>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <label style={{ ...fieldWrap, gridColumn: '1 / -1' }}>
          <span style={lbl}>Item name *</span>
          <input style={inp} value={f.name} autoFocus placeholder="e.g. Kaju Katli" onChange={e => set({ name: e.target.value })} />
          {hasWeightToken(f.name) && (
            <span style={{ fontSize: 11, color: '#B26A00' }}>
              No need for the weight in the name; pack sizes are calculated automatically.{' '}
              <button type="button" style={{ ...btnSm, padding: '1px 6px' }} onClick={() => set({ name: baseName(f.name) })}>Use "{baseName(f.name)}"</button>
            </span>
          )}
          {twin && (
            <span style={{ fontSize: 11, color: '#C0392B' }}>
              {item
                ? <>Another row "{twin.name}" exists. Use <b>Merge duplicates</b> on the items page to combine them.</>
                : <>"{twin.name}" already exists for this occasion.{' '}
                  <button type="button" style={{ ...btnSm, padding: '1px 6px' }} onClick={() => onEditOther(twin)}>Edit it instead</button></>}
            </span>
          )}
        </label>
        <label style={fieldWrap}>
          <span style={lbl}>Category</span>
          <input style={inp} list="item-categories" value={f.category ?? ''} disabled={legacy}
            placeholder={legacy ? 'After database update' : 'Sweets, Namkeen…'} onChange={e => set({ category: e.target.value || null })} />
          <datalist id="item-categories">{categories.map(c => <option key={c} value={c} />)}</datalist>
        </label>
        <label style={fieldWrap}>
          <span style={lbl}>Occasion</span>
          <select style={inp} value={f.occasion_id ?? ''} onChange={e => set({ occasion_id: e.target.value || null })}>
            <option value="">All year (any occasion)</option>
            {occasions.filter(o => o.is_active || o.id === f.occasion_id).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </label>
        <div style={fieldWrap}>
          <span style={lbl}>Sold</span>
          <div style={segWrap}>
            {(Object.keys(UNIT_NAMES) as PriceUnit[]).map(u => (
              <button key={u} type="button" style={segBtn(f.unit === u)} disabled={legacy && u === 'pc'} onClick={() => setUnit(u)}>{UNIT_NAMES[u]}</button>
            ))}
          </div>
        </div>
        <label style={fieldWrap}>
          <span style={lbl}>Price per {unitInfo.label} (₹) *</span>
          <input style={inp} inputMode="decimal" value={rateText} placeholder="e.g. 850" onChange={e => setRateText(e.target.value)} />
        </label>
      </div>

      <div style={{ marginTop: 16, padding: 12, background: '#FAFAF8', borderRadius: 10 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 10, cursor: legacy ? 'default' : 'pointer' }}>
          <input type="checkbox" checked={!ownSizes} disabled={legacy}
            onChange={e => set({ pack_sizes: e.target.checked ? null : [...defaults[f.unit]], pack_prices: e.target.checked ? null : f.pack_prices })} />
          Use shop pack sizes ({defaults[f.unit].map(s => formatSize(s, f.unit)).join(', ')})
        </label>
        {ownSizes && <SizeChips unit={f.unit} sizes={f.pack_sizes!} onChange={s => set({ pack_sizes: s })} />}

        <div style={{ fontSize: 12, fontWeight: 600, color: NAVY, margin: '12px 0 6px' }}>Pack prices (auto from rate{legacy ? '' : '; type to set your own'})</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))', gap: 8 }}>
          {packs.map(p => (
            <label key={p.size} style={{ ...fieldWrap, background: '#fff', border: '0.5px solid #E5E5E0', borderRadius: 8, padding: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{p.label}</span>
              <input style={{ ...inp, padding: '5px 8px' }} inputMode="decimal" disabled={legacy}
                value={f.pack_prices?.[String(p.size)] ?? ''} placeholder={rate ? String(Math.round((rate * p.size) / unitInfo.factor)) : '—'}
                onChange={e => setManual(p.size, e.target.value)} aria-label={`Price for ${p.label}`} />
              <span style={{ fontSize: 10, color: p.manual ? '#B26A00' : '#888880' }}>{rate ? (p.manual ? 'Manual' : `Auto ${inr(p.price)}`) : ''}</span>
            </label>
          ))}
        </div>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginTop: 12 }}>
        <input type="checkbox" checked={f.is_active} onChange={e => set({ is_active: e.target.checked })} /> Active (shown in billing)
      </label>
    </Modal>
  );
};

export default ItemFormModal;
