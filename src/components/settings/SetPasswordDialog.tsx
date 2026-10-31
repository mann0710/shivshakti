import React, { useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import { supabase } from '../../lib/supabase';
import { Foot, Input } from './SettingsDialogs';

// After an invite or reset link, or from Team & access: choose the password used to sign in next time.
const SetPasswordDialog: React.FC<{ email: string; onClose: () => void }> = ({ email, onClose }) => {
  const [pw, setPw] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState<{ pw?: string; again?: string }>({});
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (pw.length < 8) { setError({ pw: 'Use at least 8 characters' }); return; }
    if (pw !== again) { setError({ again: 'The two passwords are different' }); return; }
    setBusy(true);
    const { error: e } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (e) { setError({ pw: e.message }); return; }
    toast.success('Password saved');
    onClose();
  };

  return (
    <Modal title="Set your password" onClose={onClose} width={420} busy={busy} dirty={!!pw}
      footer={<Foot form="pw-form" onClose={onClose} primary="Save password" busy={busy} />}>
      <p className="st-sub">So {email || 'you'} can sign in with email and password next time.</p>
      <form id="pw-form" className="st-form" onSubmit={e => { e.preventDefault(); save(); }} noValidate>
        <Input label="New password" full autoFocus type="password" autoComplete="new-password" value={pw} error={error.pw} onChange={e => { setPw(e.target.value); setError({}); }} />
        <Input label="Type it again" full type="password" autoComplete="new-password" value={again} error={error.again} onChange={e => { setAgain(e.target.value); setError({}); }} />
      </form>
    </Modal>
  );
};

export default SetPasswordDialog;
