import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import {
  useDataCenter, useUpsertDataCenter,
  useTeamMembers, useCreateTeamMember, useUpdateTeamMember, useDeleteTeamMember,
  useEventTypes, useCreateEventType, useUpdateEventType, useDeleteEventType,
  DEFAULT_EVENTS,
} from '../hooks/useDataCenter';

const DataCenter: React.FC = () => {
  const { data: dc } = useDataCenter();
  const { data: teamMembers = [] } = useTeamMembers();
  const { data: eventTypes = [], isSuccess: etLoaded } = useEventTypes();
  const upsertDC = useUpsertDataCenter();
  const createMember = useCreateTeamMember();
  const updateMember = useUpdateTeamMember();
  const deleteMember = useDeleteTeamMember();
  const createEventType = useCreateEventType();
  const updateEventType = useUpdateEventType();
  const deleteEventType = useDeleteEventType();

  const [gst, setGst] = useState('');
  const [gstRate, setGstRate] = useState('18');
  const [fssaiUrl, setFssaiUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const seededRef = useRef(false);

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
    if (dc) { setGst(dc.gst_number || ''); setGstRate(String(dc.gst_rate ?? 18)); setFssaiUrl(dc.fssai_certificate_url || ''); }
  }, [dc]);

  // Auto-seed DEFAULT_EVENTS when table is empty
  useEffect(() => {
    if (!etLoaded || eventTypes.length > 0 || seededRef.current) return;
    seededRef.current = true;
    DEFAULT_EVENTS.forEach(name => {
      createEventType.mutate(name, { onError: () => {} });
    });
  }, [etLoaded, eventTypes.length]); // eslint-disable-line

  const handleSaveInfo = async () => {
    try {
      await upsertDC.mutateAsync({ gst_number: gst, gst_rate: parseFloat(gstRate) || 18, fssai_certificate_url: fssaiUrl });
      toast.success('Business info saved!');
    } catch (e: any) { toast.error(e?.message || 'Failed to save'); }
  };

  const extractStoragePath = (url: string) => {
    const m = url.match(/\/documents\/(.+?)(\?|$)/);
    return m?.[1] ? decodeURIComponent(m[1]) : null;
  };

  const handleFssaiUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      // Delete old file from storage before replacing
      if (fssaiUrl) {
        const oldPath = extractStoragePath(fssaiUrl);
        if (oldPath) await supabase.storage.from('documents').remove([oldPath]).catch(() => {});
      }
      const path = `fssai/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from('documents').upload(path, file, { upsert: true });
      if (upErr) {
        if (upErr.message?.toLowerCase().includes('bucket')) {
          toast.error('Storage bucket missing. See setup instructions below.', { duration: 6000 });
        } else {
          toast.error(upErr.message || 'Upload failed');
        }
        return;
      }
      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path);
      setFssaiUrl(publicUrl);
      await upsertDC.mutateAsync({ gst_number: gst, gst_rate: parseFloat(gstRate) || 18, fssai_certificate_url: publicUrl });
      toast.success(fssaiUrl ? 'Certificate replaced!' : 'Certificate uploaded!');
    } catch (e: any) {
      toast.error(e?.message || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteFssai = async () => {
    if (!fssaiUrl || !window.confirm('Remove the FSSAI certificate? This cannot be undone.')) return;
    try {
      const oldPath = extractStoragePath(fssaiUrl);
      if (oldPath) await supabase.storage.from('documents').remove([oldPath]).catch(() => {});
      setFssaiUrl('');
      await upsertDC.mutateAsync({ gst_number: gst, gst_rate: parseFloat(gstRate) || 18, fssai_certificate_url: '' });
      toast.success('Certificate removed');
    } catch (e: any) { toast.error(e?.message || 'Failed to remove'); }
  };

  const handleDownloadFssai = async () => {
    if (!fssaiUrl) return;
    try {
      const res = await fetch(fssaiUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = fssaiUrl.split('.').pop()?.split('?')[0] || 'pdf';
      a.download = `fssai_certificate.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { window.open(fssaiUrl, '_blank'); }
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
              <label style={lbl}>GST Rate (%)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="number" min="0" max="100" step="0.5"
                  style={{ ...inp, maxWidth: 100 }}
                  value={gstRate}
                  onChange={e => setGstRate(e.target.value)}
                  placeholder="18"
                />
                <span style={{ fontSize: 12, color: '#888880' }}>% (used in billing)</span>
              </div>
            </div>
            <div>
              <label style={lbl}>FSSAI Certificate</label>
              {fssaiUrl ? (
                <>
                  <div style={{ background: '#EAF3DE', border: '0.5px solid #B6D98E', borderRadius: 8, padding: '8px 12px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>📄</span>
                    <span style={{ fontSize: 12, color: '#3B6D11', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {decodeURIComponent(fssaiUrl.split('/').pop()?.split('?')[0] || '').replace(/^\d+_/, '') || 'Certificate'}
                    </span>
                    <span style={{ fontSize: 10, color: '#3B6D11' }}>✓ Uploaded</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <a href={fssaiUrl} target="_blank" rel="noreferrer" style={{ ...btnGhost, fontSize: 12, textDecoration: 'none', display: 'inline-block' }}>👁 View</a>
                    <button onClick={handleDownloadFssai} style={{ ...btnGhost, fontSize: 12 }}>⬇ Download</button>
                    <label style={{ ...btnGhost, fontSize: 12, cursor: 'pointer', display: 'inline-block', textAlign: 'center' }}>
                      {uploading ? 'Uploading...' : '🔄 Replace'}
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFssaiUpload} style={{ display: 'none' }} disabled={uploading} />
                    </label>
                    <button onClick={handleDeleteFssai} style={{ ...btnGhost, fontSize: 12, color: '#CC4444', borderColor: '#CC4444' }}>🗑 Delete</button>
                  </div>
                </>
              ) : (
                <label style={{ ...btnGhost, fontSize: 12, cursor: 'pointer', display: 'inline-block', textAlign: 'center', minWidth: 100 }}>
                  {uploading ? 'Uploading...' : '📎 Upload'}
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFssaiUpload} style={{ display: 'none' }} disabled={uploading} />
                </label>
              )}
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

        <div style={{ marginTop: 16, padding: '12px 16px', background: '#FFF8EE', border: '0.5px solid #FAC775', borderRadius: 8, fontSize: 12, color: '#854F0B', lineHeight: 2 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>📋 One-time Supabase setup required</div>
          <div><strong>1. Storage bucket</strong> (needed for FSSAI upload) — Supabase Dashboard → Storage → New bucket → Name: <code style={{ background: '#FFF0CC', padding: '1px 5px', borderRadius: 3 }}>documents</code> → enable <strong>Public bucket</strong> → Create</div>
          <div style={{ marginTop: 4 }}><strong>2. GST Rate column</strong> (if "Save Information" fails) — Supabase Dashboard → SQL Editor → run:</div>
          <code style={{ display: 'block', background: '#FFF0CC', padding: '4px 8px', borderRadius: 4, fontSize: 11, marginTop: 2 }}>
            ALTER TABLE data_center ADD COLUMN IF NOT EXISTS gst_rate numeric DEFAULT 18;
          </code>
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
