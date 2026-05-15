import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import {
  useDataCenter, useUpsertDataCenter,
  useTeamMembers, useCreateTeamMember, useUpdateTeamMember, useDeleteTeamMember,
  useEventTypes, useCreateEventType, useUpdateEventType, useDeleteEventType,
} from '../hooks/useDataCenter';

const DataCenter: React.FC = () => {
  const { data: dc } = useDataCenter();
  const { data: teamMembers = [] } = useTeamMembers();
  const { data: eventTypes = [] } = useEventTypes();
  const upsertDC = useUpsertDataCenter();
  const createMember = useCreateTeamMember();
  const updateMember = useUpdateTeamMember();
  const deleteMember = useDeleteTeamMember();
  const createEventType = useCreateEventType();
  const updateEventType = useUpdateEventType();
  const deleteEventType = useDeleteEventType();

  const [gst, setGst] = useState('');
  const [fssaiUrl, setFssaiUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  // Team member form
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [memberForm, setMemberForm] = useState({ name: '', mobile: '', email: '' });
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editMemberForm, setEditMemberForm] = useState({ name: '', mobile: '', email: '' });

  // Event type form
  const [newEventName, setNewEventName] = useState('');
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editEventName, setEditEventName] = useState('');

  useEffect(() => {
    if (dc) { setGst(dc.gst_number || ''); setFssaiUrl(dc.fssai_certificate_url || ''); }
  }, [dc]);

  const handleSaveInfo = async () => {
    try {
      await upsertDC.mutateAsync({ gst_number: gst, fssai_certificate_url: fssaiUrl });
      toast.success('Business info saved!');
    } catch (e: any) { toast.error(e?.message || 'Failed to save'); }
  };

  const handleFssaiUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = `fssai/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from('documents').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path);
      setFssaiUrl(publicUrl);
      await upsertDC.mutateAsync({ gst_number: gst, fssai_certificate_url: publicUrl });
      toast.success('Certificate uploaded!');
    } catch (e: any) {
      toast.error(e?.message || 'Upload failed — create a public "documents" bucket in Supabase Storage first.');
    } finally { setUploading(false); }
  };

  // ── Team member handlers ──────────────────────────────────────────────────
  const handleAddMember = async () => {
    if (!memberForm.name) { toast.error('Name is required'); return; }
    try {
      await createMember.mutateAsync(memberForm);
      toast.success('Member added!');
      setMemberForm({ name: '', mobile: '', email: '' });
      setShowMemberForm(false);
    } catch (e: any) { toast.error(e?.message || 'Failed to add'); }
  };

  const handleUpdateMember = async (id: string) => {
    if (!editMemberForm.name) { toast.error('Name is required'); return; }
    try {
      await updateMember.mutateAsync({ id, ...editMemberForm });
      toast.success('Member updated!');
      setEditingMemberId(null);
    } catch (e: any) { toast.error(e?.message || 'Failed to update'); }
  };

  const handleDeleteMember = async (id: string) => {
    try {
      await deleteMember.mutateAsync(id);
      toast.success('Member removed');
    } catch (e: any) { toast.error(e?.message || 'Failed to remove'); }
  };

  // ── Event type handlers ───────────────────────────────────────────────────
  const handleAddEventType = async () => {
    if (!newEventName.trim()) { toast.error('Enter event name'); return; }
    try {
      await createEventType.mutateAsync(newEventName.trim());
      toast.success('Event type added!');
      setNewEventName('');
    } catch (e: any) { toast.error(e?.message || 'Failed to add'); }
  };

  const handleUpdateEventType = async (id: string) => {
    if (!editEventName.trim()) { toast.error('Enter event name'); return; }
    try {
      await updateEventType.mutateAsync({ id, name: editEventName.trim() });
      toast.success('Updated!');
      setEditingEventId(null);
    } catch (e: any) { toast.error(e?.message || 'Failed to update'); }
  };

  const handleDeleteEventType = async (id: string) => {
    try {
      await deleteEventType.mutateAsync(id);
      toast.success('Event type removed');
    } catch (e: any) { toast.error(e?.message || 'Failed to remove'); }
  };

  return (
    <div>
      <div className="page-topbar">
        <div style={{ fontSize: 16, fontWeight: 600 }}>Data Center</div>
        <div style={{ fontSize: 11, color: '#888880' }}>Business settings & team</div>
      </div>
      <div className="page-content">

        {/* Business Info */}
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Business Information</div>
          <div className="g3" style={{ marginBottom: 16 }}>
            <div>
              <label style={lbl}>GST Number</label>
              <input style={inp} value={gst} onChange={e => setGst(e.target.value)} placeholder="e.g. 24ABCDE1234F1Z5" />
            </div>
            <div>
              <label style={lbl}>FSSAI Certificate</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <label style={{ ...btnGhost, fontSize: 12, cursor: 'pointer', display: 'inline-block', textAlign: 'center', minWidth: 100 }}>
                  {uploading ? 'Uploading...' : '📎 Upload'}
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFssaiUpload} style={{ display: 'none' }} disabled={uploading} />
                </label>
                {fssaiUrl && <a href={fssaiUrl} target="_blank" rel="noreferrer" style={{ ...btnGhost, fontSize: 12, textDecoration: 'none', display: 'inline-block' }}>👁 View</a>}
              </div>
              {fssaiUrl && <div style={{ fontSize: 10, color: '#3B6D11', marginTop: 4 }}>Certificate uploaded ✓</div>}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button style={btnPrimary} onClick={handleSaveInfo}>Save Information</button>
          </div>
        </div>

        {/* Event Types */}
        <div style={{ ...card, padding: 0, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #E5E5E0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Event Types</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input style={{ ...inp, width: 160, marginBottom: 0 }} value={newEventName}
                onChange={e => setNewEventName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddEventType()}
                placeholder="New event name..." />
              <button style={btnPrimary} onClick={handleAddEventType}>+ Add</button>
            </div>
          </div>
          {eventTypes.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#888880', fontSize: 13 }}>
              No event types yet. Add from above, or run the SQL seed in Supabase.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <tbody>
                {eventTypes.map(et => (
                  <tr key={et.id} style={{ borderTop: '0.5px solid #F0F0EC' }}>
                    <td style={{ padding: '9px 16px' }}>
                      {editingEventId === et.id ? (
                        <input style={{ ...inp, width: '100%' }} value={editEventName}
                          onChange={e => setEditEventName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleUpdateEventType(et.id)} autoFocus />
                      ) : (
                        <span style={{ fontWeight: 500 }}>{et.name}</span>
                      )}
                    </td>
                    <td style={{ padding: '9px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {editingEventId === et.id ? (
                        <>
                          <button onClick={() => handleUpdateEventType(et.id)} style={{ ...btnPrimary, fontSize: 11, padding: '3px 10px', marginRight: 6 }}>Save</button>
                          <button onClick={() => setEditingEventId(null)} style={{ ...btnGhost, fontSize: 11, padding: '3px 10px' }}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => { setEditingEventId(et.id); setEditEventName(et.name); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#378ADD', fontSize: 12, marginRight: 8 }}>✏ Edit</button>
                          <button onClick={() => handleDeleteEventType(et.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#A32D2D', fontSize: 16 }}>×</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Team Members */}
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #E5E5E0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Team Members</div>
            <button style={btnPrimary} onClick={() => setShowMemberForm(!showMemberForm)}>+ Add Member</button>
          </div>

          {showMemberForm && (
            <div style={{ padding: 16, borderBottom: '0.5px solid #E5E5E0', background: '#FAFAF8' }}>
              <div className="g3" style={{ marginBottom: 12 }}>
                <div><label style={lbl}>Full name *</label><input style={inp} value={memberForm.name} onChange={e => setMemberForm({ ...memberForm, name: e.target.value })} placeholder="Rahul Shah" /></div>
                <div><label style={lbl}>Mobile</label><input style={inp} value={memberForm.mobile} onChange={e => setMemberForm({ ...memberForm, mobile: e.target.value })} placeholder="+91 98765 43210" /></div>
                <div><label style={lbl}>Email</label><input type="email" style={inp} value={memberForm.email} onChange={e => setMemberForm({ ...memberForm, email: e.target.value })} placeholder="rahul@example.com" /></div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button style={btnGhost} onClick={() => { setShowMemberForm(false); setMemberForm({ name: '', mobile: '', email: '' }); }}>Cancel</button>
                <button style={btnPrimary} onClick={handleAddMember}>Add Member</button>
              </div>
            </div>
          )}

          {teamMembers.length === 0 && !showMemberForm ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#888880', fontSize: 13 }}>No team members added yet.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#FAFAF8' }}>
                  {['Name', 'Mobile', 'Email', ''].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '9px 14px', fontWeight: 500, color: '#888880', fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teamMembers.map(m => (
                  <tr key={m.id} style={{ borderTop: '0.5px solid #F0F0EC' }}>
                    {editingMemberId === m.id ? (
                      <>
                        <td style={{ padding: '8px 14px' }}><input style={inp} value={editMemberForm.name} onChange={e => setEditMemberForm({ ...editMemberForm, name: e.target.value })} /></td>
                        <td style={{ padding: '8px 14px' }}><input style={inp} value={editMemberForm.mobile} onChange={e => setEditMemberForm({ ...editMemberForm, mobile: e.target.value })} /></td>
                        <td style={{ padding: '8px 14px' }}><input type="email" style={inp} value={editMemberForm.email} onChange={e => setEditMemberForm({ ...editMemberForm, email: e.target.value })} /></td>
                        <td style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>
                          <button onClick={() => handleUpdateMember(m.id)} style={{ ...btnPrimary, fontSize: 11, padding: '3px 10px', marginRight: 6 }}>Save</button>
                          <button onClick={() => setEditingMemberId(null)} style={{ ...btnGhost, fontSize: 11, padding: '3px 10px' }}>Cancel</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ padding: '10px 14px', fontWeight: 500 }}>{m.name}</td>
                        <td style={{ padding: '10px 14px', color: '#666660' }}>{m.mobile || '—'}</td>
                        <td style={{ padding: '10px 14px', color: '#666660' }}>{m.email || '—'}</td>
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                          <button onClick={() => { setEditingMemberId(m.id); setEditMemberForm({ name: m.name, mobile: m.mobile || '', email: m.email || '' }); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#378ADD', fontSize: 12, marginRight: 8 }}>✏ Edit</button>
                          <button onClick={() => handleDeleteMember(m.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#A32D2D', fontSize: 16 }}>×</button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ marginTop: 16, padding: '10px 14px', background: '#FFF8EE', border: '0.5px solid #FAC775', borderRadius: 8, fontSize: 12, color: '#854F0B' }}>
          💡 For FSSAI uploads, create a public storage bucket named <strong>documents</strong> in Supabase → Storage.
        </div>
      </div>
    </div>
  );
};

const card: React.CSSProperties = { background: '#FFFFFF', border: '0.5px solid #E5E5E0', borderRadius: 12, padding: 16 };
const btnPrimary: React.CSSProperties = { background: '#E8750A', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 };
const btnGhost: React.CSSProperties = { background: 'transparent', border: '0.5px solid #D0D0CC', padding: '6px 12px', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#666660' };
const lbl: React.CSSProperties = { fontSize: 11, color: '#888880', display: 'block', marginBottom: 4 };
const inp: React.CSSProperties = { width: '100%', padding: '7px 10px', borderRadius: 7, border: '0.5px solid #D0D0CC', fontSize: 13, background: '#FFFFFF', color: '#1A1A18', boxSizing: 'border-box' };

export default DataCenter;
