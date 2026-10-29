import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useMenus, useCreateMenu, useUpdateMenu } from '../hooks/useMenus';
import { Menu } from '../types';
import Modal from '../components/ui/Modal';
import { useConfirm } from '../components/ui/ConfirmDialog';

const CATEGORIES = ['Gujarati', 'Punjabi', 'South Indian', 'Continental', 'Jain', 'Package'];
const emptyForm = { name: '', description: '', price_per_plate: '', category: 'Gujarati', items: '' };
type Form = typeof emptyForm;

const accentColors: Record<string, { accent: string }> = {
  Gujarati: { accent: '#E8750A' }, Punjabi: { accent: '#378ADD' }, 'South Indian': { accent: '#639922' },
  Continental: { accent: '#7F77DD' }, Jain: { accent: '#1D9E75' }, Package: { accent: '#BA7517' },
};

const toForm = (m: Menu): Form => ({
  name: m.name, description: m.description || '', price_per_plate: String(m.price_per_plate),
  category: m.category, items: (m.items || []).join('\n'),
});

// Ready-made per-plate packages; add/edit opens in a dialog so it is always visible.
const Menus: React.FC = () => {
  const [showInactive, setShowInactive] = useState(false);
  const { data: menus = [], isLoading } = useMenus(showInactive);
  const createMenu = useCreateMenu();
  const updateMenu = useUpdateMenu();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [editing, setEditing] = useState<Menu | 'new' | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);

  const open = (m: Menu | 'new') => { setEditing(m); setForm(m === 'new' ? emptyForm : toForm(m)); };
  const close = () => { setEditing(null); setForm(emptyForm); };

  const save = async () => {
    const price = parseFloat(form.price_per_plate);
    if (!form.name.trim() || !(price > 0)) { toast.error('Name and a price per plate are required'); return; }
    const payload = {
      name: form.name.trim(), description: form.description.trim(), price_per_plate: price, category: form.category,
      items: form.items.split('\n').map(i => i.trim()).filter(Boolean),
    };
    try {
      if (editing === 'new') await createMenu.mutateAsync({ ...payload, is_active: true });
      else if (editing) await updateMenu.mutateAsync({ id: editing.id, ...payload });
      toast.success(editing === 'new' ? 'Package added' : 'Package updated');
      close();
    } catch (e: any) { toast.error(e?.message || 'Could not save'); }
  };

  const setActive = async (m: Menu, is_active: boolean) => {
    if (!is_active && !(await confirm({ title: `Deactivate ${m.name}?`, message: 'It will no longer be offered for new bookings. You can reactivate it any time from "Show inactive".', confirmLabel: 'Deactivate', danger: true }))) return;
    try { await updateMenu.mutateAsync({ id: m.id, is_active }); toast.success(is_active ? 'Package reactivated' : 'Package deactivated'); }
    catch (e: any) { toast.error(e?.message || 'Failed'); }
  };

  const set = (patch: Partial<Form>) => setForm(f => ({ ...f, ...patch }));

  return (
    <div>
      <div className="page-topbar">
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Menus & Packages</div>
          <div style={{ fontSize: 11, color: '#888880', marginTop: 2 }}>Fixed per-plate packages used for booking estimates</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <label style={{ fontSize: 12, color: '#666660', display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} /> Show inactive
          </label>
          <button style={btnPrimary} onClick={() => open('new')}>+ New Menu</button>
        </div>
      </div>
      <div className="page-content">
        {isLoading && <div style={{ color: '#888880', fontSize: 13, padding: 40, textAlign: 'center' }}>Loading menus...</div>}

        {menus.length === 0 && !isLoading && (
          <div style={{ ...card, textAlign: 'center', padding: 40, color: '#888880', fontSize: 13 }}>
            No menus yet. Click "+ New Menu" to add your first menu.
          </div>
        )}

        <div className="g-menus">
          {menus.map(m => (
            <div key={m.id} style={{ ...card, opacity: m.is_active ? 1 : 0.6 }}>
              <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{m.name}{!m.is_active && <span style={{ fontSize: 10, color: '#A32D2D', marginLeft: 6 }}>Inactive</span>}</div>
                  <div style={{ fontSize: 11, color: '#888880', marginTop: 2 }}>{m.category}</div>
                  {m.description && <div style={{ fontSize: 11, color: '#AAAAAA', marginTop: 2 }}>{m.description}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: (accentColors[m.category] ?? accentColors.Gujarati).accent }}>₹{m.price_per_plate}</div>
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
                <button style={{ ...btnGhost, flex: 1, fontSize: 12 }} onClick={() => open(m)}>Edit</button>
                <button onClick={() => setActive(m, !m.is_active)}
                  style={{ ...btnGhost, flex: 1, fontSize: 12, color: m.is_active ? '#A32D2D' : '#3B6D11' }}>{m.is_active ? 'Deactivate' : 'Reactivate'}</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {editing && (
        <Modal title={editing === 'new' ? 'Add new menu' : `Edit ${editing.name}`} onClose={close} width={560}
          footer={<>
            <button style={btnGhost} onClick={close}>Cancel</button>
            <button style={btnPrimary} onClick={save} disabled={createMenu.isPending || updateMenu.isPending}>{editing === 'new' ? 'Save Menu' : 'Update Menu'}</button>
          </>}>
          <div className="g3" style={{ marginBottom: 10 }}>
            <div><label style={lbl}>Menu name *</label><input style={inp} value={form.name} autoFocus onChange={e => set({ name: e.target.value })} placeholder="e.g. Gujarati Thali" /></div>
            <div><label style={lbl}>Price per plate (₹) *</label><input type="number" min={0} style={inp} value={form.price_per_plate} onChange={e => set({ price_per_plate: e.target.value })} placeholder="450" /></div>
            <div><label style={lbl}>Category</label>
              <select style={inp} value={form.category} onChange={e => set({ category: e.target.value })}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 10 }}><label style={lbl}>Description</label><input style={inp} value={form.description} onChange={e => set({ description: e.target.value })} placeholder="Short description" /></div>
          <label style={lbl}>Menu items (one per line)</label>
          <textarea style={{ ...inp, height: 120, resize: 'vertical' }} value={form.items} onChange={e => set({ items: e.target.value })}
            placeholder={'Dal, Rice, Roti\nShaak (2 types)\nKadhi, Papad\nShrikhand'} />
        </Modal>
      )}
      {confirmDialog}
    </div>
  );
};

const card: React.CSSProperties = { background: '#FFFFFF', border: '0.5px solid #E5E5E0', borderRadius: 12, padding: 16 };
const btnPrimary: React.CSSProperties = { background: '#E8750A', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 };
const btnGhost: React.CSSProperties = { background: 'transparent', border: '0.5px solid #D0D0CC', padding: '6px 12px', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#666660' };
const lbl: React.CSSProperties = { fontSize: 11, color: '#888880', display: 'block', marginBottom: 4 };
const inp: React.CSSProperties = { width: '100%', padding: '7px 10px', borderRadius: 7, border: '0.5px solid #D0D0CC', fontSize: 13, background: '#FFFFFF', color: '#1A1A18' };

export default Menus;
