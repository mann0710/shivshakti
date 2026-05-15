import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import {
  useDataCenter, useUpsertDataCenter,
  useTeamMembers, useCreateTeamMember, useDeleteTeamMember,
} from '../hooks/useDataCenter';

const DataCenter: React.FC = () => {
  const { data: dc } = useDataCenter();
  const { data: teamMembers = [] } = useTeamMembers();
  const upsertDC = useUpsertDataCenter();
  const createMember = useCreateTeamMember();
  const deleteMember = useDeleteTeamMember();

  const [gst, setGst] = useState('');
  const [fssaiUrl, setFssaiUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [memberForm, setMemberForm] = useState({ name: '', mobile: '', email: '' });
  const [showMemberForm, setShowMemberForm] = useState(false);

  useEffect(() => {
    if (dc) {
      setGst(dc.gst_number || '');
      setFssaiUrl(dc.fssai_certificate_url || '');
    }
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
      toast.success('FSSAI certificate uploaded!');
    } catch (e: any) {
      toast.error(e?.message || 'Upload failed. Make sure "documents" storage bucket is created in Supabase.');
    } finally { setUploading(false); }
  };

  const handleAddMember = async () => {
    if (!memberForm.name) { toast.error('Name is required'); return; }
    try {
      await createMember.mutateAsync(memberForm);
      toast.success('Team member added!');
      setMemberForm({ name: '', mobile: '', email: '' });
      setShowMemberForm(false);
    } catch (e: any) { toast.error(e?.message || 'Failed to add member'); }
  };

  const handleDeleteMember = async (id: string) => {
    try {
      await deleteMember.mutateAsync(id);
      toast.success('Member removed');
    } catch (e: any) { toast.error(e?.message || 'Failed to remove'); }
  };

  return (
    <div>
      <div className="page-topbar">
        <div style={{ fontSize: 16, fontWeight: 600 }}>Data Center</div>
        <div style={{ fontSize: 11, color: '#888880' }}>Business settings & team</div>
      </div>
      <div className="page-content">

        {/* Business Information */}
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Business Information</div>

          <div className="g3" style={{ marginBottom: 16 }}>
            <div>
              <label style={lbl}>GST Number</label>
              <input style={inp} value={gst} onChange={e => setGst(e.target.value)}
                placeholder="e.g. 24ABCDE1234F1Z5" />
            </div>

            <div>
              <label style={lbl}>FSSAI Certificate</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <label style={{ ...btnGhost, fontSize: 12, cursor: 'pointer', display: 'inline-block', textAlign: 'center', minWidth: 100 }}>
                  {uploading ? 'Uploading...' : '📎 Upload'}
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFssaiUpload}
                    style={{ display: 'none' }} disabled={uploading} />
                </label>
                {fssaiUrl && (
                  <a href={fssaiUrl} target="_blank" rel="noreferrer"
                    style={{ ...btnGhost, fontSize: 12, textDecoration: 'none', display: 'inline-block', textAlign: 'center' }}>
                    👁 View
                  </a>
                )}
              </div>
              {fssaiUrl && <div style={{ fontSize: 10, color: '#888880', marginTop: 4 }}>Certificate uploaded ✓</div>}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button style={btnPrimary} onClick={handleSaveInfo}>Save Information</button>
          </div>
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
                <div>
                  <label style={lbl}>Full name *</label>
                  <input style={inp} value={memberForm.name} onChange={e => setMemberForm({ ...memberForm, name: e.target.value })} placeholder="e.g. Rahul Shah" />
                </div>
                <div>
                  <label style={lbl}>Mobile</label>
                  <input style={inp} value={memberForm.mobile} onChange={e => setMemberForm({ ...memberForm, mobile: e.target.value })} placeholder="+91 98765 43210" />
                </div>
                <div>
                  <label style={lbl}>Email</label>
                  <input type="email" style={inp} value={memberForm.email} onChange={e => setMemberForm({ ...memberForm, email: e.target.value })} placeholder="rahul@example.com" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button style={btnGhost} onClick={() => { setShowMemberForm(false); setMemberForm({ name: '', mobile: '', email: '' }); }}>Cancel</button>
                <button style={btnPrimary} onClick={handleAddMember}>Add Member</button>
              </div>
            </div>
          )}

          {teamMembers.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#888880', fontSize: 13 }}>
              No team members added yet. Add members to invite them to calendar events.
            </div>
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
                    <td style={{ padding: '10px 14px', fontWeight: 500 }}>{m.name}</td>
                    <td style={{ padding: '10px 14px', color: '#666660' }}>{m.mobile || '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#666660' }}>{m.email || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <button onClick={() => handleDeleteMember(m.id)}
                        style={{ background: 'none', border: 'none', color: '#A32D2D', cursor: 'pointer', fontSize: 16 }}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ marginTop: 16, padding: '10px 14px', background: '#FFF8EE', border: '0.5px solid #FAC775', borderRadius: 8, fontSize: 12, color: '#854F0B' }}>
          💡 To enable FSSAI document uploads, create a public storage bucket named <strong>documents</strong> in your Supabase project under Storage.
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

export default DataCenter;
