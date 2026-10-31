import React, { useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import { useConfirm } from '../ui/ConfirmDialog';
import { StaffLogin, StaffRole } from '../../types';
import { ROLES } from '../navItems';
import { cleanPhone, isValidPhone } from '../../lib/money';
import { sendInvite, useRemoveStaff, useSaveStaff } from '../../hooks/useStaff';
import { EMAIL_RE, Foot, Input } from './SettingsDialogs';
import '../../styles/settings-data.css';

// Settings → Team & access → tap someone or Invite: name, contact, what they can do and whether they can sign in.
export const TeamLoginDialog: React.FC<{ login?: StaffLogin; me: string; onClose: () => void }> = ({ login, me, onClose }) => {
  const save = useSaveStaff();
  const remove = useRemoveStaff();
  const { confirm, dialog } = useConfirm();
  const start = { name: login?.name ?? '', mobile: login?.mobile ?? '', email: login?.email ?? '', role: login?.role ?? ('counter' as StaffRole), can_sign_in: login?.can_sign_in ?? true };
  const [f, setF] = useState(start);
  const [errors, setErrors] = useState<{ name?: string; mobile?: string; email?: string }>({});
  const [sending, setSending] = useState(false);
  const busy = save.isPending || remove.isPending || sending;
  const isMe = !!login && login.email.toLowerCase() === me.toLowerCase();
  const set = (patch: Partial<typeof start>) => { setF(x => ({ ...x, ...patch })); setErrors({}); };
  const bind = (k: 'name' | 'mobile' | 'email') => ({ value: f[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => set({ [k]: e.target.value }) });

  const submit = async () => {
    const e: typeof errors = {};
    if (!f.name.trim()) e.name = 'Type a name';
    if (f.mobile.trim() && !isValidPhone(f.mobile)) e.mobile = 'Use a 10-digit mobile number';
    if (!EMAIL_RE.test(f.email.trim())) e.email = 'They sign in with this email';
    if (Object.keys(e).length) { setErrors(e); return; }
    const invite = !login && f.can_sign_in;
    const row = { email: f.email.trim().toLowerCase(), name: f.name.trim(), mobile: f.mobile.trim() ? cleanPhone(f.mobile) : null, role: f.role, can_sign_in: f.can_sign_in, invited_at: invite ? new Date().toISOString() : login?.invited_at ?? null };
    try {
      await save.mutateAsync({ row, isNew: !login });
      if (invite) {
        setSending(true);
        await sendInvite(row.email);
        toast.success(`Invite sent to ${row.email}`);
      } else toast.success('Saved');
      onClose();
    } catch (err: any) { toast.error(err?.message || 'Could not save', { duration: 9000 }); if (/no email went out/.test(err?.message ?? '')) onClose(); }
    finally { setSending(false); }
  };

  const drop = async () => {
    if (!login || !(await confirm({ title: `Remove ${login.name || login.email}?`, message: 'They can no longer sign in. Their past work stays.', confirmLabel: 'Remove', danger: true }))) return;
    try { await remove.mutateAsync(login.email); toast.success('Removed'); onClose(); } catch (err: any) { toast.error(err?.message || 'Could not remove'); }
  };

  const resend = async () => {
    if (!login) return;
    setSending(true);
    try { await sendInvite(login.email); await save.mutateAsync({ row: { ...login, invited_at: new Date().toISOString() }, isNew: false }); toast.success(`Sign-in link sent to ${login.email}`); }
    catch (err: any) { toast.error(err?.message || 'Could not send', { duration: 9000 }); }
    finally { setSending(false); }
  };

  return (
    <Modal title="Team member" onClose={onClose} width={440} busy={busy} dirty={JSON.stringify(f) !== JSON.stringify(start)}
      footer={<Foot form="login-form" onRemove={login && !isMe ? drop : undefined} onClose={onClose} busy={busy}
        primary={!login && f.can_sign_in ? 'Send invite' : 'Save'} />}>
      <p className="st-sub">Counter staff never see Money or Settings.</p>
      <form id="login-form" className="st-form" onSubmit={e => { e.preventDefault(); submit(); }} noValidate>
        <Input label="Name" full autoFocus placeholder="Full name" error={errors.name} {...bind('name')} />
        <Input label="Mobile" type="tel" inputMode="tel" placeholder="10 digits" error={errors.mobile} {...bind('mobile')} />
        <Input label="Email" type="email" placeholder="To sign in" error={errors.email} disabled={!!login} {...bind('email')} />
        <div className="st-field full" role="group" aria-label="Can do">
          <span>Can do</span>
          <span className="st-picks">
            {ROLES.map(r => (
              <button key={r.id} type="button" className="st-pick" aria-pressed={f.role === r.id} disabled={isMe} onClick={() => set({ role: r.id })}>{r.label}</button>
            ))}
          </span>
          <small>{ROLES.find(r => r.id === f.role)?.note}{isMe ? ' · You can’t change your own role' : ''}</small>
        </div>
        <label className="st-check full">
          <input type="checkbox" checked={f.can_sign_in} disabled={isMe} onChange={e => set({ can_sign_in: e.target.checked })} />Can sign in
        </label>
      </form>
      {login && !isMe && login.can_sign_in && (
        <p className="st-sub" style={{ margin: '12px 0 0' }}>
          {login.invited_at ? `Invited ${new Date(login.invited_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}. ` : ''}
          <button type="button" className="st-link" onClick={resend} disabled={busy}>Email a sign-in link</button>
        </p>
      )}
      {dialog}
    </Modal>
  );
};
