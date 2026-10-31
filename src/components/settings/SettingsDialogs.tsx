import React, { useState } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import { useConfirm } from '../ui/ConfirmDialog';
import { undoToast } from '../pos/undoToast';
import { EventType, TeamMember } from '../../types';
import { cleanPhone, isValidPhone } from '../../lib/money';
import {
  useCreateEventType, useUpdateEventType, useDeleteEventType,
  useCreateTeamMember, useUpdateTeamMember, useDeleteTeamMember,
} from '../../hooks/useDataCenter';
import { fileNameOf, uploadedOn, useFssai } from './useFssai';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const Input: React.FC<{ label: string; error?: string; full?: boolean } & React.InputHTMLAttributes<HTMLInputElement>> = ({ label, error, full, ...rest }) => (
  <label className={`st-field${full ? ' full' : ''}`}><span>{label}</span><input className={error ? 'bad' : ''} {...rest} />{error && <small className="bad">{error}</small>}</label>
);

const Foot: React.FC<{ onRemove?: () => void; removeLabel?: string; onClose: () => void; primary: string; busy?: boolean; form?: string }> = ({ onRemove, removeLabel = 'Remove', onClose, primary, busy, form }) => (
  <>
    {onRemove && <button type="button" className="st-danger-link" onClick={onRemove} disabled={busy}>{removeLabel}</button>}
    <button type="button" className="ui-btn" onClick={onClose}>Cancel</button>
    <button type="submit" form={form} className="ui-btn primary" disabled={busy}>{busy ? 'Saving…' : primary}</button>
  </>
);

// Settings → Catering → Event types: add, rename or remove one.
export const EventTypeDialog: React.FC<{ type?: EventType; usedBy: number; names: string[]; onClose: () => void }> = ({ type, usedBy, names, onClose }) => {
  const create = useCreateEventType();
  const update = useUpdateEventType();
  const del = useDeleteEventType();
  const [name, setName] = useState(type?.name ?? '');
  const [error, setError] = useState('');
  const busy = create.isPending || update.isPending || del.isPending;

  const save = async () => {
    const n = name.trim();
    if (!n) { setError('Type a name'); return; }
    if (names.some(x => x.toLowerCase() === n.toLowerCase() && x !== type?.name)) { setError(`${n} is already on the list`); return; }
    try {
      if (type) await update.mutateAsync({ id: type.id, name: n, oldName: type.name });
      else await create.mutateAsync(n);
      toast.success(type ? 'Event type saved' : `${n} added`);
      onClose();
    } catch (e: any) { toast.error(e?.message || 'Could not save'); }
  };

  const remove = async () => {
    if (!type) return;
    try {
      await del.mutateAsync(type.id);
      undoToast(`${type.name} removed`, () => create.mutate(type.name));
      onClose();
    } catch (e: any) { toast.error(e?.message || 'Could not remove'); }
  };

  return (
    <Modal title="Event type" onClose={onClose} width={420} busy={busy} dirty={name !== (type?.name ?? '')}
      footer={<Foot form="event-type-form" onRemove={type ? remove : undefined} onClose={onClose} primary="Save" busy={busy} />}>
      <p className="st-sub">Offered in the booking form.</p>
      <form id="event-type-form" className="st-form" onSubmit={e => { e.preventDefault(); save(); }} noValidate>
        <Input label="Name" full autoFocus value={name} error={error} onChange={e => { setName(e.target.value); setError(''); }} />
      </form>
      {type && <p className="st-sub" style={{ marginTop: 12, marginBottom: 0 }}>
        {usedBy ? `Used by ${usedBy} booking${usedBy === 1 ? '' : 's'}. Renaming changes it on those too.` : 'No bookings use it yet.'}
      </p>}
    </Modal>
  );
};

// Settings → Team & access → team list for events (cooks and helpers; they don't sign in).
export const TeamMemberDialog: React.FC<{ member?: TeamMember; onClose: () => void }> = ({ member, onClose }) => {
  const create = useCreateTeamMember();
  const update = useUpdateTeamMember();
  const del = useDeleteTeamMember();
  const start = { name: member?.name ?? '', mobile: member?.mobile ?? '', email: member?.email ?? '' };
  const [f, setF] = useState(start);
  const [errors, setErrors] = useState<Partial<typeof start>>({});
  const busy = create.isPending || update.isPending || del.isPending;
  const bind = (k: keyof typeof start) => ({ value: f[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => { setF(x => ({ ...x, [k]: e.target.value })); setErrors({}); } });

  const save = async () => {
    const e: Partial<typeof start> = {};
    if (!f.name.trim()) e.name = 'Type a name';
    if (f.mobile.trim() && !isValidPhone(f.mobile)) e.mobile = 'Use a 10-digit mobile number';
    if (f.email.trim() && !EMAIL_RE.test(f.email.trim())) e.email = 'Check the email address';
    if (Object.keys(e).length) { setErrors(e); return; }
    const row = { name: f.name.trim(), mobile: f.mobile.trim() ? cleanPhone(f.mobile) : '', email: f.email.trim() };
    try {
      if (member) await update.mutateAsync({ id: member.id, ...row });
      else await create.mutateAsync(row);
      toast.success(member ? 'Saved' : `${row.name} added`);
      onClose();
    } catch (err: any) { toast.error(err?.message || 'Could not save'); }
  };

  const remove = async () => {
    if (!member) return;
    try {
      await del.mutateAsync(member.id);
      undoToast(`${member.name} removed`, () => create.mutate({ name: member.name, mobile: member.mobile, email: member.email }));
      onClose();
    } catch (err: any) { toast.error(err?.message || 'Could not remove'); }
  };

  return (
    <Modal title="Team member" onClose={onClose} width={440} busy={busy} dirty={JSON.stringify(f) !== JSON.stringify(start)}
      footer={<Foot form="team-form" onRemove={member ? remove : undefined} onClose={onClose} primary="Save" busy={busy} />}>
      <p className="st-sub">Cooks and helpers for events. They don't sign in to the app.</p>
      <form id="team-form" className="st-form" onSubmit={e => { e.preventDefault(); save(); }} noValidate>
        <Input label="Name" full autoFocus placeholder="Full name" error={errors.name} {...bind('name')} />
        <Input label="Mobile" type="tel" inputMode="tel" placeholder="10 digits" error={errors.mobile} {...bind('mobile')} />
        <Input label="Email" type="email" placeholder="Optional" error={errors.email} {...bind('email')} />
      </form>
    </Modal>
  );
};

// Settings → Business → FSSAI certificate: view, download, replace or remove the uploaded file.
export const FssaiDialog: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { url, busy, upload, remove, download } = useFssai();
  const { confirm, dialog } = useConfirm();
  const when = uploadedOn(url);
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) upload(file); };

  const drop = async () => {
    if (!(await confirm({ title: 'Remove FSSAI certificate?', message: 'The uploaded file is deleted. This cannot be undone.', confirmLabel: 'Remove', danger: true }))) return;
    await remove();
    onClose();
  };

  return (
    <Modal title="FSSAI certificate" onClose={onClose} width={440} busy={busy}
      footer={<>
        {url && <button type="button" className="st-danger-link" onClick={drop} disabled={busy}>Remove certificate…</button>}
        <button type="button" className="ui-btn" onClick={onClose}>Close</button>
      </>}>
      <p className="st-sub">{url ? `${when ? `Uploaded ${format(when, 'd MMM')} · ` : ''}${fileNameOf(url)}` : 'No certificate uploaded yet. PDF, JPG or PNG.'}</p>
      <div className="st-cards">
        {url && <a className="st-card-btn" href={url} target="_blank" rel="noopener noreferrer"><b>View</b><span>Opens the file</span></a>}
        {url && <button type="button" className="st-card-btn" onClick={download}><b>Download</b><span>Save a copy</span></button>}
        <label className={`st-card-btn${busy ? ' busy' : ''}`}>
          <b>{busy ? 'Uploading…' : url ? 'Replace' : 'Upload'}</b><span>{url ? 'Upload a new file' : 'Pick the certificate file'}</span>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={pick} disabled={busy} className="st-file" />
        </label>
      </div>
      {dialog}
    </Modal>
  );
};
