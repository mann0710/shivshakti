import React, { useState } from 'react';
import toast from 'react-hot-toast';
import {
  useMenuCategories, useCreateCategory, useUpdateCategory, useDeleteCategory,
  useMenuSubcategories, useCreateSubcategory, useUpdateSubcategory, useDeleteSubcategory,
  useMenuItemsFull, useCreateMenuItem, useUpdateMenuItem, useDeleteMenuItem,
  MenuCategory, MenuSubcategory, MenuItem,
} from '../hooks/useMenuBuilder';

const MenuBuilder: React.FC = () => {
  const { data: categories = [] } = useMenuCategories();
  const { data: subcategories = [] } = useMenuSubcategories();
  const { data: items = [] } = useMenuItemsFull();

  const createCat = useCreateCategory();
  const updateCat = useUpdateCategory();
  const deleteCat = useDeleteCategory();
  const createSub = useCreateSubcategory();
  const updateSub = useUpdateSubcategory();
  const deleteSub = useDeleteSubcategory();
  const createItem = useCreateMenuItem();
  const updateItem = useUpdateMenuItem();
  const deleteItem = useDeleteMenuItem();

  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);

  // Add form state
  const [newCatName, setNewCatName] = useState('');
  const [newSubName, setNewSubName] = useState('');
  const [newSubCatId, setNewSubCatId] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemSubId, setNewItemSubId] = useState('');

  // Inline edit state
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [editSubName, setEditSubName] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemName, setEditItemName] = useState('');

  const filteredSubs = selectedCatId
    ? subcategories.filter(s => s.category_id === selectedCatId)
    : subcategories;

  const filteredItems = selectedSubId
    ? items.filter(i => i.subcategory_id === selectedSubId)
    : selectedCatId
      ? items.filter(i => i.subcategory?.category_id === selectedCatId)
      : items;

  // ── Category handlers ────────────────────────────────────────────────────
  const handleAddCat = async () => {
    if (!newCatName.trim()) { toast.error('Enter category name'); return; }
    try { await createCat.mutateAsync(newCatName.trim()); toast.success('Category added!'); setNewCatName(''); }
    catch (e: any) { toast.error(e.message || 'Failed'); }
  };

  const handleToggleCat = async (cat: MenuCategory) => {
    try { await updateCat.mutateAsync({ id: cat.id, is_active: !cat.is_active }); }
    catch (e: any) { toast.error(e.message || 'Failed'); }
  };

  const handleSaveCat = async (id: string) => {
    if (!editCatName.trim()) { toast.error('Enter name'); return; }
    try { await updateCat.mutateAsync({ id, name: editCatName.trim() }); toast.success('Updated!'); setEditingCatId(null); }
    catch (e: any) { toast.error(e.message || 'Failed'); }
  };

  const handleDeleteCat = async (id: string) => {
    if (!window.confirm('Delete this category and all its subcategories & items?')) return;
    try { await deleteCat.mutateAsync(id); toast.success('Deleted'); if (selectedCatId === id) { setSelectedCatId(null); setSelectedSubId(null); } }
    catch (e: any) { toast.error(e.message || 'Failed'); }
  };

  // ── Subcategory handlers ─────────────────────────────────────────────────
  const handleAddSub = async () => {
    const catId = newSubCatId || selectedCatId;
    if (!newSubName.trim() || !catId) { toast.error('Select a category and enter subcategory name'); return; }
    try { await createSub.mutateAsync({ name: newSubName.trim(), category_id: catId }); toast.success('Subcategory added!'); setNewSubName(''); }
    catch (e: any) { toast.error(e.message || 'Failed'); }
  };

  const handleToggleSub = async (sub: MenuSubcategory) => {
    try { await updateSub.mutateAsync({ id: sub.id, is_active: !sub.is_active }); }
    catch (e: any) { toast.error(e.message || 'Failed'); }
  };

  const handleSaveSub = async (id: string) => {
    if (!editSubName.trim()) { toast.error('Enter name'); return; }
    try { await updateSub.mutateAsync({ id, name: editSubName.trim() }); toast.success('Updated!'); setEditingSubId(null); }
    catch (e: any) { toast.error(e.message || 'Failed'); }
  };

  const handleDeleteSub = async (id: string) => {
    if (!window.confirm('Delete this subcategory and all its items?')) return;
    try { await deleteSub.mutateAsync(id); toast.success('Deleted'); if (selectedSubId === id) setSelectedSubId(null); }
    catch (e: any) { toast.error(e.message || 'Failed'); }
  };

  // ── Item handlers ────────────────────────────────────────────────────────
  const handleAddItem = async () => {
    const subId = newItemSubId || selectedSubId;
    if (!newItemName.trim() || !subId) { toast.error('Select a subcategory and enter item name'); return; }
    try { await createItem.mutateAsync({ name: newItemName.trim(), subcategory_id: subId }); toast.success('Item added!'); setNewItemName(''); }
    catch (e: any) { toast.error(e.message || 'Failed'); }
  };

  const handleToggleItem = async (item: MenuItem) => {
    try { await updateItem.mutateAsync({ id: item.id, is_active: !item.is_active }); }
    catch (e: any) { toast.error(e.message || 'Failed'); }
  };

  const handleSaveItem = async (id: string) => {
    if (!editItemName.trim()) { toast.error('Enter name'); return; }
    try { await updateItem.mutateAsync({ id, name: editItemName.trim() }); toast.success('Updated!'); setEditingItemId(null); }
    catch (e: any) { toast.error(e.message || 'Failed'); }
  };

  const handleDeleteItem = async (id: string) => {
    try { await deleteItem.mutateAsync(id); toast.success('Deleted'); }
    catch (e: any) { toast.error(e.message || 'Failed'); }
  };

  return (
    <div>
      <div className="page-topbar">
        <div style={{ fontSize: 16, fontWeight: 600 }}>Menu Builder</div>
        <div style={{ fontSize: 11, color: '#888880' }}>Manage categories, subcategories & items</div>
      </div>
      <div className="page-content">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }} className="menu-builder-grid">

          {/* ── CATEGORIES ───────────────────────────────────────────── */}
          <div style={col}>
            <div style={colHeader}>
              <span style={colTitle}>Categories</span>
              <span style={{ fontSize: 11, color: '#AAAAAA' }}>{categories.length} total</span>
            </div>
            <div style={{ padding: '10px 12px', borderBottom: '0.5px solid #F0F0EC', display: 'flex', gap: 6 }}>
              <input style={{ ...inp, flex: 1 }} placeholder="New category…" value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddCat()} />
              <button style={btnAdd} onClick={handleAddCat}>+</button>
            </div>
            <div style={{ overflowY: 'auto', maxHeight: 480 }}>
              {categories.length === 0 && <Empty text="No categories yet" />}
              {categories.map(cat => (
                <div key={cat.id}
                  onClick={() => { setSelectedCatId(selectedCatId === cat.id ? null : cat.id); setSelectedSubId(null); }}
                  style={{ ...row, background: selectedCatId === cat.id ? '#FFFBF5' : 'transparent', borderLeft: selectedCatId === cat.id ? '3px solid #E8750A' : '3px solid transparent' }}>
                  {editingCatId === cat.id ? (
                    <div style={{ display: 'flex', gap: 6, flex: 1 }} onClick={e => e.stopPropagation()}>
                      <input style={{ ...inp, flex: 1 }} value={editCatName} onChange={e => setEditCatName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSaveCat(cat.id)} autoFocus />
                      <button style={btnSm} onClick={() => handleSaveCat(cat.id)}>✓</button>
                      <button style={btnSmGhost} onClick={() => setEditingCatId(null)}>✕</button>
                    </div>
                  ) : (
                    <>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: cat.is_active ? '#1A1A18' : '#AAAAAA', textDecoration: cat.is_active ? 'none' : 'line-through' }}>{cat.name}</div>
                        <div style={{ fontSize: 10, color: '#AAAAAA', marginTop: 2 }}>
                          {subcategories.filter(s => s.category_id === cat.id).length} subcategories
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => handleToggleCat(cat)} style={{ ...pill, background: cat.is_active ? '#EAF3DE' : '#F5F5F3', color: cat.is_active ? '#3B6D11' : '#AAAAAA' }}>
                          {cat.is_active ? 'Active' : 'Inactive'}
                        </button>
                        <button onClick={() => { setEditingCatId(cat.id); setEditCatName(cat.name); }} style={iconBtn}>✏</button>
                        <button onClick={() => handleDeleteCat(cat.id)} style={{ ...iconBtn, color: '#A32D2D' }}>×</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── SUBCATEGORIES ────────────────────────────────────────── */}
          <div style={col}>
            <div style={colHeader}>
              <span style={colTitle}>Subcategories</span>
              <span style={{ fontSize: 11, color: '#AAAAAA' }}>
                {selectedCatId ? `of "${categories.find(c => c.id === selectedCatId)?.name}"` : 'all'}
              </span>
            </div>
            <div style={{ padding: '10px 12px', borderBottom: '0.5px solid #F0F0EC' }}>
              {!selectedCatId && (
                <select style={{ ...inp, marginBottom: 6 }} value={newSubCatId} onChange={e => setNewSubCatId(e.target.value)}>
                  <option value="">Select category…</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
              <div style={{ display: 'flex', gap: 6 }}>
                <input style={{ ...inp, flex: 1 }} placeholder="New subcategory…" value={newSubName}
                  onChange={e => setNewSubName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddSub()} />
                <button style={btnAdd} onClick={handleAddSub}>+</button>
              </div>
            </div>
            <div style={{ overflowY: 'auto', maxHeight: 480 }}>
              {filteredSubs.length === 0 && <Empty text={selectedCatId ? 'No subcategories in this category' : 'No subcategories yet'} />}
              {filteredSubs.map(sub => (
                <div key={sub.id}
                  onClick={() => setSelectedSubId(selectedSubId === sub.id ? null : sub.id)}
                  style={{ ...row, background: selectedSubId === sub.id ? '#F5F0FF' : 'transparent', borderLeft: selectedSubId === sub.id ? '3px solid #7F77DD' : '3px solid transparent' }}>
                  {editingSubId === sub.id ? (
                    <div style={{ display: 'flex', gap: 6, flex: 1 }} onClick={e => e.stopPropagation()}>
                      <input style={{ ...inp, flex: 1 }} value={editSubName} onChange={e => setEditSubName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSaveSub(sub.id)} autoFocus />
                      <button style={btnSm} onClick={() => handleSaveSub(sub.id)}>✓</button>
                      <button style={btnSmGhost} onClick={() => setEditingSubId(null)}>✕</button>
                    </div>
                  ) : (
                    <>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: sub.is_active ? '#1A1A18' : '#AAAAAA', textDecoration: sub.is_active ? 'none' : 'line-through' }}>{sub.name}</div>
                        <div style={{ fontSize: 10, color: '#AAAAAA', marginTop: 2 }}>
                          {sub.category?.name} · {items.filter(i => i.subcategory_id === sub.id).length} items
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => handleToggleSub(sub)} style={{ ...pill, background: sub.is_active ? '#EAF3DE' : '#F5F5F3', color: sub.is_active ? '#3B6D11' : '#AAAAAA' }}>
                          {sub.is_active ? 'Active' : 'Inactive'}
                        </button>
                        <button onClick={() => { setEditingSubId(sub.id); setEditSubName(sub.name); }} style={iconBtn}>✏</button>
                        <button onClick={() => handleDeleteSub(sub.id)} style={{ ...iconBtn, color: '#A32D2D' }}>×</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── ITEMS ────────────────────────────────────────────────── */}
          <div style={col}>
            <div style={colHeader}>
              <span style={colTitle}>Items</span>
              <span style={{ fontSize: 11, color: '#AAAAAA' }}>
                {selectedSubId ? `of "${subcategories.find(s => s.id === selectedSubId)?.name}"` : selectedCatId ? `of "${categories.find(c => c.id === selectedCatId)?.name}"` : 'all'}
              </span>
            </div>
            <div style={{ padding: '10px 12px', borderBottom: '0.5px solid #F0F0EC' }}>
              {!selectedSubId && (
                <select style={{ ...inp, marginBottom: 6 }} value={newItemSubId} onChange={e => setNewItemSubId(e.target.value)}>
                  <option value="">Select subcategory…</option>
                  {(selectedCatId ? filteredSubs : subcategories).map(s => (
                    <option key={s.id} value={s.id}>{s.category?.name} / {s.name}</option>
                  ))}
                </select>
              )}
              <div style={{ display: 'flex', gap: 6 }}>
                <input style={{ ...inp, flex: 1 }} placeholder="New item…" value={newItemName}
                  onChange={e => setNewItemName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddItem()} />
                <button style={btnAdd} onClick={handleAddItem}>+</button>
              </div>
            </div>
            <div style={{ overflowY: 'auto', maxHeight: 480 }}>
              {filteredItems.length === 0 && <Empty text={selectedSubId ? 'No items in this subcategory' : 'No items yet'} />}
              {filteredItems.map(item => (
                <div key={item.id} style={{ ...row, borderLeft: '3px solid transparent', cursor: 'default' }}>
                  {editingItemId === item.id ? (
                    <div style={{ display: 'flex', gap: 6, flex: 1 }}>
                      <input style={{ ...inp, flex: 1 }} value={editItemName} onChange={e => setEditItemName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSaveItem(item.id)} autoFocus />
                      <button style={btnSm} onClick={() => handleSaveItem(item.id)}>✓</button>
                      <button style={btnSmGhost} onClick={() => setEditingItemId(null)}>✕</button>
                    </div>
                  ) : (
                    <>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: item.is_active ? '#1A1A18' : '#AAAAAA', textDecoration: item.is_active ? 'none' : 'line-through' }}>{item.name}</div>
                        <div style={{ fontSize: 10, color: '#AAAAAA', marginTop: 2 }}>
                          {item.subcategory?.category?.name} / {item.subcategory?.name}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <button onClick={() => handleToggleItem(item)} style={{ ...pill, background: item.is_active ? '#EAF3DE' : '#F5F5F3', color: item.is_active ? '#3B6D11' : '#AAAAAA' }}>
                          {item.is_active ? 'Active' : 'Inactive'}
                        </button>
                        <button onClick={() => { setEditingItemId(item.id); setEditItemName(item.name); }} style={iconBtn}>✏</button>
                        <button onClick={() => handleDeleteItem(item.id)} style={{ ...iconBtn, color: '#A32D2D' }}>×</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 14, padding: '10px 14px', background: '#F0F4FF', border: '0.5px solid #B8C8F4', borderRadius: 8, fontSize: 12, color: '#3353A4' }}>
          💡 Click a <strong>category</strong> to filter subcategories. Click a <strong>subcategory</strong> to filter items. Inactive categories/subcategories are hidden in Quotations.
        </div>
      </div>
    </div>
  );
};

const Empty: React.FC<{ text: string }> = ({ text }) => (
  <div style={{ padding: '24px 16px', textAlign: 'center', color: '#AAAAAA', fontSize: 12 }}>{text}</div>
);

const col: React.CSSProperties = { background: '#FFFFFF', border: '0.5px solid #E5E5E0', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' };
const colHeader: React.CSSProperties = { padding: '12px 14px', borderBottom: '0.5px solid #E5E5E0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAFAF8' };
const colTitle: React.CSSProperties = { fontSize: 13, fontWeight: 600 };
const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderBottom: '0.5px solid #F0F0EC', cursor: 'pointer', transition: 'background 0.1s' };
const pill: React.CSSProperties = { fontSize: 10, padding: '2px 8px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' };
const iconBtn: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: '#378ADD', fontSize: 13, padding: '2px 4px' };
const btnAdd: React.CSSProperties = { background: '#E8750A', color: '#fff', border: 'none', padding: '7px 12px', borderRadius: 7, fontSize: 16, cursor: 'pointer', lineHeight: 1 };
const btnSm: React.CSSProperties = { background: '#E8750A', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer' };
const btnSmGhost: React.CSSProperties = { background: 'transparent', border: '0.5px solid #D0D0CC', color: '#666660', padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer' };
const inp: React.CSSProperties = { width: '100%', padding: '6px 9px', borderRadius: 6, border: '0.5px solid #D0D0CC', fontSize: 12, background: '#FFFFFF', color: '#1A1A18', boxSizing: 'border-box' };

export default MenuBuilder;
