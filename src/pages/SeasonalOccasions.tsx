import React, { useState } from 'react';
import toast from 'react-hot-toast';
import {
  useSeasonalOccasions, useCreateSeasonalOccasion, useUpdateSeasonalOccasion, useDeleteSeasonalOccasion,
  SeasonalOccasion,
} from '../hooks/useSeasonalOccasions';

const SeasonalOccasions: React.FC = () => {
  const { data: occasions = [], isLoading } = useSeasonalOccasions();
  const createOccasion = useCreateSeasonalOccasion();
  const updateOccasion = useUpdateSeasonalOccasion();
  const deleteOccasion = useDeleteSeasonalOccasion();

  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) { toast.error('Occasion name required'); return; }
    try {
      await createOccasion.mutateAsync(name);
      setNewName('');
      toast.success('Occasion added');
    } catch (e: any) {
      toast.error(e.message || 'Error');
    }
  };

  const startEdit = (occ: SeasonalOccasion) => {
    setEditingId(occ.id);
    setEditingName(occ.name);
  };

  const saveEdit = async (id: string) => {
    const name = editingName.trim();
    if (!name) { toast.error('Name required'); return; }
    try {
      await updateOccasion.mutateAsync({ id, name });
      setEditingId(null);
      toast.success('Updated');
    } catch (e: any) {
      toast.error(e.message || 'Error');
    }
  };

  const toggleActive = async (occ: SeasonalOccasion) => {
    try {
      await updateOccasion.mutateAsync({ id: occ.id, is_active: !occ.is_active });
      toast.success(occ.is_active ? 'Deactivated' : 'Activated');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this occasion? Items linked to it will be unlinked.')) return;
    try {
      await deleteOccasion.mutateAsync(id);
      toast.success('Deleted');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const active = occasions.filter(o => o.is_active);
  const inactive = occasions.filter(o => !o.is_active);

  return (
    <div>
      <div className="page-topbar">
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Occasions</div>
          <div style={{ fontSize: 11, color: '#888880', marginTop: 2 }}>
            {active.length} active · {inactive.length} inactive
          </div>
        </div>
      </div>

      <div className="page-content">
        {/* Add form */}
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Add Occasion</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div style={{ flex: 1, maxWidth: 360 }}>
              <label style={lbl}>Occasion Name</label>
              <input
                style={{ ...inp, width: '100%', marginTop: 4 }}
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                placeholder="e.g. Diwali, Raksha Bandhan, Makar Sankranti..."
              />
            </div>
            <button style={btnPrimary} onClick={handleAdd} disabled={createOccasion.isPending}>
              + Add
            </button>
          </div>
        </div>

        {isLoading ? (
          <div style={{ color: '#888880', fontSize: 13 }}>Loading...</div>
        ) : occasions.length === 0 ? (
          <div style={{ color: '#888880', fontSize: 13, textAlign: 'center', marginTop: 32 }}>
            No occasions yet. Add your first one above.
          </div>
        ) : (
          <div style={{ background: '#fff', border: '0.5px solid #E5E5E0', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F9F8F5', borderBottom: '0.5px solid #E5E5E0' }}>
                  <th style={th}>Occasion Name</th>
                  <th style={th}>Status</th>
                  <th style={{ ...th, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {occasions.map((occ, idx) => (
                  <tr
                    key={occ.id}
                    style={{
                      borderBottom: idx < occasions.length - 1 ? '0.5px solid #F0F0EC' : 'none',
                      opacity: occ.is_active ? 1 : 0.55,
                    }}
                  >
                    <td style={td}>
                      {editingId === occ.id ? (
                        <input
                          style={{ ...inp, minWidth: 220 }}
                          value={editingName}
                          onChange={e => setEditingName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveEdit(occ.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          autoFocus
                        />
                      ) : (
                        <span style={{ fontWeight: 500 }}>{occ.name}</span>
                      )}
                    </td>
                    <td style={td}>
                      <span style={{
                        fontSize: 11, padding: '3px 10px', borderRadius: 20,
                        background: occ.is_active ? '#EAF3DE' : '#F5F5F0',
                        color: occ.is_active ? '#3B6D11' : '#888880',
                        fontWeight: 600,
                      }}>
                        {occ.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        {editingId === occ.id ? (
                          <>
                            <button style={{ ...btnSm, color: '#1A237E' }} onClick={() => saveEdit(occ.id)}>Save</button>
                            <button style={btnSm} onClick={() => setEditingId(null)}>Cancel</button>
                          </>
                        ) : (
                          <>
                            <button style={btnSm} onClick={() => startEdit(occ)}>Edit</button>
                            <button
                              style={{ ...btnSm, color: occ.is_active ? '#888880' : '#3B6D11' }}
                              onClick={() => toggleActive(occ)}
                            >
                              {occ.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                            <button style={{ ...btnSm, color: '#E24B4A' }} onClick={() => handleDelete(occ.id)}>Delete</button>
                          </>
                        )}
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

const btnPrimary: React.CSSProperties = { background: '#1A237E', color: '#fff', border: 'none', padding: '7px 18px', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 };
const btnSm: React.CSSProperties = { background: '#F5F5F0', border: '0.5px solid #E5E5E0', padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: '#444' };
const card: React.CSSProperties = { background: '#fff', border: '0.5px solid #E5E5E0', borderRadius: 12, padding: 16, marginBottom: 16 };
const lbl: React.CSSProperties = { fontSize: 11, color: '#888880', fontWeight: 500, display: 'block' };
const inp: React.CSSProperties = { border: '1px solid #E5E5E0', borderRadius: 7, padding: '7px 10px', fontSize: 13, background: '#fff' };
const th: React.CSSProperties = { padding: '10px 14px', fontWeight: 600, textAlign: 'left', fontSize: 12, color: '#888880' };
const td: React.CSSProperties = { padding: '10px 14px' };

export default SeasonalOccasions;
