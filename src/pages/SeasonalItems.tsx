import React, { useState } from 'react';
import toast from 'react-hot-toast';
import {
  useSeasonalItems, useCreateSeasonalItem, useUpdateSeasonalItem, useDeleteSeasonalItem,
  SeasonalItem,
} from '../hooks/useSeasonalItems';

const WEIGHT_OPTIONS = [
  { label: '250 gm', value: 250, unit: 'gm' },
  { label: '500 gm', value: 500, unit: 'gm' },
  { label: '750 gm', value: 750, unit: 'gm' },
  { label: '1 kg',   value: 1000, unit: 'gm' },
  { label: '2 kg',   value: 2000, unit: 'gm' },
  { label: '250 ltr', value: 250, unit: 'ltr' },
  { label: '500 ltr', value: 500, unit: 'ltr' },
  { label: '1 ltr',   value: 1000, unit: 'ltr' },
  { label: '2 ltr',   value: 2000, unit: 'ltr' },
];

function weightLabel(weight: number, unit: string) {
  if (unit === 'gm' && weight >= 1000) return `${weight / 1000} kg`;
  return `${weight} ${unit}`;
}

const emptyForm = () => ({ name: '', weight: 250, weight_unit: 'gm' as 'gm' | 'ltr', price: '' as string | number });

const SeasonalItems: React.FC = () => {
  const { data: items = [], isLoading } = useSeasonalItems();
  const createItem = useCreateSeasonalItem();
  const updateItem = useUpdateSeasonalItem();
  const deleteItem = useDeleteSeasonalItem();

  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const activeItems = items.filter(i => i.is_active);

  const gmOptions = WEIGHT_OPTIONS.filter(o => o.unit === 'gm');
  const ltrOptions = WEIGHT_OPTIONS.filter(o => o.unit === 'ltr');
  const weightOptions = form.weight_unit === 'gm' ? gmOptions : ltrOptions;

  const handleUnitToggle = (unit: 'gm' | 'ltr') => {
    const opts = unit === 'gm' ? gmOptions : ltrOptions;
    setForm(f => ({ ...f, weight_unit: unit, weight: opts[0].value }));
  };

  const openAdd = () => {
    setForm(emptyForm());
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (item: SeasonalItem) => {
    setForm({ name: item.name, weight: item.weight, weight_unit: item.weight_unit, price: item.price });
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    const name = form.name.trim();
    const price = Number(form.price);
    if (!name) { toast.error('Item name required'); return; }
    if (!price || price <= 0) { toast.error('Valid price required'); return; }

    const payload = { name, weight: form.weight, weight_unit: form.weight_unit, price, is_active: true };
    try {
      if (editingId) {
        await updateItem.mutateAsync({ id: editingId, ...payload });
        toast.success('Item updated');
      } else {
        await createItem.mutateAsync(payload);
        toast.success('Item added');
      }
      setShowForm(false);
    } catch (e: any) {
      toast.error(e.message || 'Error saving item');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this item?')) return;
    try {
      await deleteItem.mutateAsync(id);
      toast.success('Deleted');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div>
      <div className="page-topbar">
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Seasonal Items</div>
          <div style={{ fontSize: 11, color: '#888880', marginTop: 2 }}>{activeItems.length} items in catalog</div>
        </div>
        <button style={btnPrimary} onClick={openAdd}>+ Add Item</button>
      </div>

      <div className="page-content">
        {showForm && (
          <div style={formCard}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>
              {editingId ? 'Edit Item' : 'New Item'}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
              <div style={fieldWrap}>
                <label style={lbl}>Item Name</label>
                <input
                  style={inp}
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Kaju Katli"
                />
              </div>

              <div style={fieldWrap}>
                <label style={lbl}>Unit</label>
                <div style={{ display: 'flex', gap: 0, border: '1px solid #E5E5E0', borderRadius: 7, overflow: 'hidden' }}>
                  {(['gm', 'ltr'] as const).map(u => (
                    <button
                      key={u}
                      onClick={() => handleUnitToggle(u)}
                      style={{
                        padding: '6px 16px', fontSize: 12, border: 'none', cursor: 'pointer',
                        background: form.weight_unit === u ? '#1A237E' : '#F9F8F5',
                        color: form.weight_unit === u ? '#fff' : '#444',
                        fontWeight: form.weight_unit === u ? 600 : 400,
                      }}
                    >{u}</button>
                  ))}
                </div>
              </div>

              <div style={fieldWrap}>
                <label style={lbl}>Weight</label>
                <select
                  style={inp}
                  value={form.weight}
                  onChange={e => setForm(f => ({ ...f, weight: Number(e.target.value) }))}
                >
                  {weightOptions.map(o => (
                    <option key={o.label} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div style={fieldWrap}>
                <label style={lbl}>Price (₹)</label>
                <input
                  style={inp}
                  type="number"
                  min={0}
                  value={form.price}
                  onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                  placeholder="0"
                />
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button style={btnPrimary} onClick={handleSave}>Save</button>
                <button style={btnGhost} onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div style={{ color: '#888880', fontSize: 13 }}>Loading...</div>
        ) : activeItems.length === 0 ? (
          <div style={{ color: '#888880', fontSize: 13, marginTop: 24, textAlign: 'center' }}>
            No items yet. Click "Add Item" to start building your catalog.
          </div>
        ) : (
          <div style={{ background: '#fff', border: '0.5px solid #E5E5E0', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F9F8F5', borderBottom: '0.5px solid #E5E5E0' }}>
                  <th style={th}>Item Name</th>
                  <th style={th}>Weight</th>
                  <th style={th}>Price</th>
                  <th style={{ ...th, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeItems.map((item, idx) => (
                  <tr key={item.id} style={{ borderBottom: idx < activeItems.length - 1 ? '0.5px solid #F0F0EC' : 'none' }}>
                    <td style={td}>{item.name}</td>
                    <td style={td}>{weightLabel(item.weight, item.weight_unit)}</td>
                    <td style={td}>₹{item.price.toLocaleString()}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <button style={btnSm} onClick={() => openEdit(item)}>Edit</button>
                      <button style={{ ...btnSm, color: '#E24B4A', marginLeft: 6 }} onClick={() => handleDelete(item.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const btnPrimary: React.CSSProperties = { background: '#1A237E', color: '#fff', border: 'none', padding: '7px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 };
const btnGhost: React.CSSProperties = { background: 'transparent', border: '0.5px solid #D0D0CC', padding: '7px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#666660' };
const btnSm: React.CSSProperties = { background: '#F5F5F0', border: '0.5px solid #E5E5E0', padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: '#444' };
const formCard: React.CSSProperties = { background: '#fff', border: '0.5px solid #E5E5E0', borderRadius: 12, padding: 16, marginBottom: 16 };
const fieldWrap: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 };
const lbl: React.CSSProperties = { fontSize: 11, color: '#888880', fontWeight: 500 };
const inp: React.CSSProperties = { border: '1px solid #E5E5E0', borderRadius: 7, padding: '6px 10px', fontSize: 13, minWidth: 140, background: '#fff' };
const th: React.CSSProperties = { padding: '10px 14px', fontWeight: 600, textAlign: 'left', fontSize: 12, color: '#888880' };
const td: React.CSSProperties = { padding: '10px 14px' };

export default SeasonalItems;
