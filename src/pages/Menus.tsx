import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useMenus, useCreateMenu, useUpdateMenu } from '../hooks/useMenus';
import { Menu } from '../types';

const CATEGORIES = ['Gujarati', 'Punjabi', 'South Indian', 'Continental', 'Jain', 'Package'];
const emptyForm = { name: '', description: '', price_per_plate: '', category: 'Gujarati', items: '' };

const Menus: React.FC = () => {
  const { data: menus = [], isLoading } = useMenus();
  const createMenu = useCreateMenu();
  const updateMenu = useUpdateMenu();

  const [showForm, setShowForm] = useState(false);
  const [editingMenu, setEditingMenu] = useState<Menu | null>(null);
  const [form, setForm] = useState(emptyForm);

  const handleAdd = async () => {
    if (!form.name || !form.price_per_plate) { toast.error('Name and price required'); return; }
    try {
      await createMenu.mutateAsync({
        name: form.name, description: form.description,
        price_per_plate: parseFloat(form.price_per_plate),
        category: form.category,
        items: form.items.split('\n').map(i => i.trim()).filter(Boolean),
        is_active: true,
      });
      toast.success('Menu added!');
      setShowForm(false);
      setForm(emptyForm);
    } catch (e: any) { toast.error(e?.message || 'Failed to add menu'); }
  };

  const handleEdit = (m: Menu) => {
    setEditingMenu(m);
    setForm({ name: m.name, description: m.description || '', price_per_plate: String(m.price_per_plate), category: m.category, items: (m.items || []).join('\n') });
    setShowForm(false);
  };

  const handleUpdate = async () => {
    if (!editingMenu || !form.name || !form.price_per_plate) { toast.error('Name and price required'); return; }
    try {
      await updateMenu.mutateAsync({
        id: editingMenu.id,
        name: form.name, description: form.description,
        price_per_plate: parseFloat(form.price_per_plate),
        category: form.category,
        items: form.items.split('\n').map(i => i.trim()).filter(Boolean),
      });
      toast.success('Menu updated!');
      setEditingMenu(null);
      setForm(emptyForm);
    } catch (e: any) { toast.error(e?.message || 'Failed to update menu'); }
  };

  const accentColors: Record<string, { bg: string; text: string; accent: string }> = {
    Gujarati:    { bg: '#FFF0E0', text: '#BA7517', accent: '#E8750A' },
    Punjabi:     { bg: '#E6F1FB', text: '#185FA5', accent: '#378ADD' },
    'South Indian': { bg: '#EAF3DE', text: '#3B6D11', accent: '#639922' },
    Continental: { bg: '#EEEDFE', text: '#534AB7', accent: '#7F77DD' },
    Jain:        { bg: '#E1F5EE', text: '#0F6E56', accent: '#1D9E75' },
    Package:     { bg: '#FAEEDA', text: '#854F0B', accent: '#BA7517' },
  };

  return (
    <div>
      <div className="page-topbar">
        <div style={{ fontSize: 16, fontWeight: 600 }}>Menus & Packages</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={btnPrimary} onClick={() => setShowForm(!showForm)}>+ New Menu</button>
        </div>
      </div>
      <div className="page-content">
        {(showForm || editingMenu) && (
          <div style={{ ...card, marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{editingMenu ? 'Edit menu' : 'Add new menu'}</div>
            <div className="g3" style={{ marginBottom: 10 }}>
              <div><label style={lbl}>Menu name *</label><input style={inp} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Gujarati Thali" /></div>
              <div><label style={lbl}>Price per plate (₹) *</label><input type="number" style={inp} value={form.price_per_plate} onChange={e => setForm({ ...form, price_per_plate: e.target.value })} placeholder="450" /></div>
              <div><label style={lbl}>Category</label>
                <select style={inp} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 10 }}><label style={lbl}>Description</label><input style={inp} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Short description" /></div>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Menu items (one per line)</label>
              <textarea style={{ ...inp, height: 90, resize: 'vertical' } as any}
                value={form.items} onChange={e => setForm({ ...form, items: e.target.value })}
                placeholder={"Dal, Rice, Roti\nShaak (2 types)\nKadhi, Papad\nShrikhand"} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={btnGhost} onClick={() => { setShowForm(false); setEditingMenu(null); setForm(emptyForm); }}>Cancel</button>
              <button style={btnPrimary} onClick={editingMenu ? handleUpdate : handleAdd}>{editingMenu ? 'Update Menu' : 'Save Menu'}</button>
            </div>
          </div>
        )}

        {isLoading && <div style={{ color: '#888880', fontSize: 13, padding: 40, textAlign: 'center' }}>Loading menus...</div>}

        {menus.length === 0 && !isLoading && (
          <div style={{ ...card, textAlign: 'center', padding: 40, color: '#888880', fontSize: 13 }}>
            No menus yet. Click "+ New Menu" to add your first menu.
          </div>
        )}

        <div className="g-menus">
          {menus.map(m => {
            const c = accentColors[m.category] || accentColors['Gujarati'];
            return (
              <div key={m.id} style={card}>
                <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{m.name}</div>
                    <div style={{ fontSize: 11, color: '#888880', marginTop: 2 }}>{m.category}</div>
                    {m.description && <div style={{ fontSize: 11, color: '#AAAAAA', marginTop: 2 }}>{m.description}</div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 16, fontWeight: 600, color: c.accent }}>₹{m.price_per_plate}</div>
                    <div style={{ fontSize: 10, color: '#888880' }}>/plate</div>
                  </div>
                </div>

                {m.items && m.items.length > 0 && (
                  <ul style={{ listStyle: 'none', fontSize: 12, color: '#666660', marginBottom: 12 }}>
                    {m.items.map((item, i) => (
                      <li key={i} style={{ padding: '3px 0', borderBottom: '0.5px solid #F0F0EC' }}>· {item}</li>
                    ))}
                  </ul>
                )}

                <div style={{ display: 'flex', gap: 6 }}>
                  <button style={{ ...btnGhost, flex: 1, fontSize: 12 }} onClick={() => handleEdit(m)}>Edit</button>
                  <button onClick={() => updateMenu.mutateAsync({ id: m.id, is_active: false }).then(() => toast.success('Menu deactivated'))}
                    style={{ ...btnGhost, flex: 1, fontSize: 12, color: '#A32D2D' }}>Deactivate</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const card: React.CSSProperties = { background: '#FFFFFF', border: '0.5px solid #E5E5E0', borderRadius: 12, padding: 16 };
const btnPrimary: React.CSSProperties = { background: '#E8750A', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 };
const btnGhost: React.CSSProperties = { background: 'transparent', border: '0.5px solid #D0D0CC', padding: '6px 12px', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#666660' };
const lbl: React.CSSProperties = { fontSize: 11, color: '#888880', display: 'block', marginBottom: 4 };
const inp: React.CSSProperties = { width: '100%', padding: '7px 10px', borderRadius: 7, border: '0.5px solid #D0D0CC', fontSize: 13, background: '#FFFFFF', color: '#1A1A18' };

export default Menus;
