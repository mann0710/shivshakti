import React, { useState } from 'react';
import toast from 'react-hot-toast';
import {
  useSeasonalItems, useCreateSeasonalItem, useUpdateSeasonalItem, useDeleteSeasonalItem,
  SeasonalItem,
} from '../hooks/useSeasonalItems';
import { useSeasonalOccasions } from '../hooks/useSeasonalOccasions';

const WEIGHT_OPTIONS_GM  = [250, 500, 750, 1000, 2000];
const WEIGHT_OPTIONS_LTR = [250, 500, 1000, 2000];

function weightLabel(weight: number, unit: string) {
  if (unit === 'gm' && weight >= 1000) return `${weight / 1000} kg`;
  return `${weight} ${unit}`;
}

type FormState = {
  name: string;
  weight: number;
  weight_unit: 'gm' | 'ltr';
  price: string | number;
  occasion_id: string;
  is_active: boolean;
};

const emptyForm = (): FormState => ({
  name: '', weight: 250, weight_unit: 'gm', price: '', occasion_id: '', is_active: true,
});

const SeasonalItems: React.FC = () => {
  const { data: items = [], isLoading } = useSeasonalItems();
  const { data: occasions = [] } = useSeasonalOccasions(false);
  const createItem  = useCreateSeasonalItem();
  const updateItem  = useUpdateSeasonalItem();
  const deleteItem  = useDeleteSeasonalItem();

  const [form, setForm]         = useState<FormState>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm]  = useState(false);
  const [filterOcc, setFilterOcc] = useState('');

  const activeOccasions = occasions.filter(o => o.is_active);
  const weightOptions   = form.weight_unit === 'gm' ? WEIGHT_OPTIONS_GM : WEIGHT_OPTIONS_LTR;

  const handleUnitToggle = (unit: 'gm' | 'ltr') => {
    const opts = unit === 'gm' ? WEIGHT_OPTIONS_GM : WEIGHT_OPTIONS_LTR;
    setForm(f => ({ ...f, weight_unit: unit, weight: opts[0] }));
  };

  const openAdd = () => {
    setForm(emptyForm());
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (item: SeasonalItem) => {
    setForm({
      name: item.name,
      weight: item.weight,
      weight_unit: item.weight_unit,
      price: item.price,
      occasion_id: item.occasion_id || '',
      is_active: item.is_active,
    });
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    const name  = form.name.trim();
    const price = Number(form.price);
    if (!name)             { toast.error('Item name required'); return; }
    if (!price || price <= 0) { toast.error('Valid price required'); return; }

    const payload = {
      name,
      weight: form.weight,
      weight_unit: form.weight_unit,
      price,
      occasion_id: form.occasion_id || undefined,
      is_active: form.is_active,
    };
    try {
      if (editingId) {
        await updateItem.mutateAsync({ id: editingId, ...payload });
        toast.success('Item updated');
      } else {
        await createItem.mutateAsync({ ...payload, is_active: true });
        toast.success('Item added');
      }
      setShowForm(false);
    } catch (e: any) {
      toast.error(e.message || 'Error saving item');
    }
  };

  const toggleActive = async (item: SeasonalItem) => {
    try {
      await updateItem.mutateAsync({ ...item, is_active: !item.is_active });
      toast.success(item.is_active ? 'Item deactivated' : 'Item activated');
    } catch (e: any) {
      toast.error(e.message);
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

  const occMap = Object.fromEntries(occasions.map(o => [o.id, o.name]));

  const displayed = items.filter(i => !filterOcc || i.occasion_id === filterOcc);

  return (
    <div>
      <div className="page-topbar">
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Sessional Items</div>
          <div style={{ fontSize: 11, color: '#888880', marginTop: 2 }}>
            {items.filter(i => i.is_active).length} active · {items.filter(i => !i.is_active).length} inactive
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            style={{ border: '0.5px solid #D0D0CC', borderRadius: 7, padding: '5px 10px', fontSize: 13, background: '#fff' }}
            value={filterOcc}
            onChange={e => setFilterOcc(e.target.value)}
          >
            <option value="">All Occasions</option>
            {occasions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <button style={btnPrimary} onClick={openAdd}>+ Add Item</button>
        </div>
      </div>

      <div className="page-content">
        {showForm && (
          <div style={formCard}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>
              {editingId ? 'Edit Item' : 'New Item'}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>

              <div style={fieldWrap}>
                <label style={lbl}>Occasion</label>
                <select style={inp} value={form.occasion_id}
                  onChange={e => setForm(f => ({ ...f, occasion_id: e.target.value }))}>
                  <option value="">— No occasion —</option>
                  {activeOccasions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>

              <div style={fieldWrap}>
                <label style={lbl}>Item Name</label>
                <input style={inp} value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Kaju Katli" />
              </div>

              <div style={fieldWrap}>
                <label style={lbl}>Unit</label>
                <div style={{ display: 'flex', gap: 0, border: '1px solid #E5E5E0', borderRadius: 7, overflow: 'hidden' }}>
                  {(['gm', 'ltr'] as const).map(u => (
                    <button key={u} onClick={() => handleUnitToggle(u)}
                      style={{
                        padding: '6px 16px', fontSize: 12, border: 'none', cursor: 'pointer',
                        background: form.weight_unit === u ? '#1A237E' : '#F9F8F5',
                        color: form.weight_unit === u ? '#fff' : '#444',
                        fontWeight: form.weight_unit === u ? 600 : 400,
                      }}>{u}</button>
                  ))}
                </div>
              </div>

              <div style={fieldWrap}>
                <label style={lbl}>Weight</label>
                <select style={inp} value={form.weight}
                  onChange={e => setForm(f => ({ ...f, weight: Number(e.target.value) }))}>
                  {weightOptions.map(w => (
                    <option key={w} value={w}>{weightLabel(w, form.weight_unit)}</option>
                  ))}
                </select>
              </div>

              <div style={fieldWrap}>
                <label style={lbl}>Price (₹)</label>
                <input style={{ ...inp, width: 100 }} type="number" min={0} value={form.price}
                  onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                  placeholder="0" />
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
        ) : displayed.length === 0 ? (
          <div style={{ color: '#888880', fontSize: 13, marginTop: 24, textAlign: 'center' }}>
            {filterOcc ? 'No items for this occasion.' : 'No items yet. Click "+ Add Item" to start.'}
          </div>
        ) : (
          <div style={{ background: '#fff', border: '0.5px solid #E5E5E0', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F9F8F5', borderBottom: '0.5px solid #E5E5E0' }}>
                  <th style={th}>Item Name</th>
                  <th style={th}>Occasion</th>
                  <th style={th}>Weight</th>
                  <th style={th}>Price</th>
                  <th style={th}>Status</th>
                  <th style={{ ...th, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((item, idx) => (
                  <tr key={item.id} style={{
                    borderBottom: idx < displayed.length - 1 ? '0.5px solid #F0F0EC' : 'none',
                    opacity: item.is_active ? 1 : 0.55,
                  }}>
                    <td style={{ ...td, fontWeight: 500 }}>{item.name}</td>
                    <td style={td}>
                      {item.occasion_id && occMap[item.occasion_id] ? (
                        <span style={{
                          fontSize: 11, padding: '2px 8px', borderRadius: 20,
                          background: '#EEF0FB', color: '#1A237E', fontWeight: 500,
                        }}>
                          {occMap[item.occasion_id]}
                        </span>
                      ) : (
                        <span style={{ color: '#AAAAAA', fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <td style={td}>{weightLabel(item.weight, item.weight_unit)}</td>
                    <td style={td}>₹{item.price.toLocaleString()}</td>
                    <td style={td}>
                      <span style={{
                        fontSize: 11, padding: '3px 8px', borderRadius: 20,
                        background: item.is_active ? '#EAF3DE' : '#F5F5F0',
                        color: item.is_active ? '#3B6D11' : '#888880',
                        fontWeight: 600,
                      }}>
                        {item.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button style={btnSm} onClick={() => openEdit(item)}>Edit</button>
                        <button
                          style={{ ...btnSm, color: item.is_active ? '#888880' : '#3B6D11' }}
                          onClick={() => toggleActive(item)}
                        >
                          {item.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button style={{ ...btnSm, color: '#E24B4A' }} onClick={() => handleDelete(item.id)}>Delete</button>
                      </div>
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
const btnGhost: React.CSSProperties   = { background: 'transparent', border: '0.5px solid #D0D0CC', padding: '7px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#666660' };
const btnSm: React.CSSProperties      = { background: '#F5F5F0', border: '0.5px solid #E5E5E0', padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: '#444' };
const formCard: React.CSSProperties   = { background: '#fff', border: '0.5px solid #E5E5E0', borderRadius: 12, padding: 16, marginBottom: 16 };
const fieldWrap: React.CSSProperties  = { display: 'flex', flexDirection: 'column', gap: 4 };
const lbl: React.CSSProperties        = { fontSize: 11, color: '#888880', fontWeight: 500 };
const inp: React.CSSProperties        = { border: '1px solid #E5E5E0', borderRadius: 7, padding: '6px 10px', fontSize: 13, minWidth: 140, background: '#fff' };
const th: React.CSSProperties         = { padding: '10px 14px', fontWeight: 600, textAlign: 'left', fontSize: 12, color: '#888880' };
const td: React.CSSProperties         = { padding: '10px 14px' };

export default SeasonalItems;
