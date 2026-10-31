import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import { Person, Side, personWithPhone, formatPhone } from '../../lib/people';
import { isValidPhone } from '../../lib/money';
import { isValidGstin } from '../../lib/gst';
import { PersonInput, usePersonActions } from '../people/usePersonActions';
import '../../styles/people.css';

interface Props {
  person?: Person;
  people: Person[];
  defaultBuys?: Side[];
  onClose: () => void;
  onSaved: (key: string) => void;
  onOpen: (key: string) => void;
  onDelete?: () => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FORM_ID = 'person-form';
type Errors = Partial<Record<'name' | 'phone' | 'email' | 'gstin', string>>;

const toInput = (p: Person | undefined, buys: Side[]): PersonInput => ({
  name: p?.name ?? '', phone: p?.phone ? formatPhone(p.phone) : '', email: p?.email ?? '', address: p?.address ?? '', gstin: p?.gstin ?? '', notes: p?.notes ?? '',
  buys: p ? [...(p.catering.length ? ['catering' as const] : []), ...(p.sweets.length ? ['sweets' as const] : [])] : buys,
});

function check(f: PersonInput): Errors {
  const e: Errors = {};
  if (!f.name.trim()) e.name = 'Type a name';
  if (f.phone.trim() && !isValidPhone(f.phone)) e.phone = 'Use a 10-digit mobile number';
  if (f.buys.includes('catering') && f.email.trim() && !EMAIL_RE.test(f.email.trim())) e.email = 'Check the email address';
  if (f.buys.includes('catering') && f.gstin.trim() && !isValidGstin(f.gstin)) e.gstin = 'GSTIN has 15 characters';
  return e;
}

// One form for catering and sweets customers; a known mobile offers the saved customer instead.
const CustomerFormModal: React.FC<Props> = ({ person, people, defaultBuys = ['catering'], onClose, onSaved, onOpen, onDelete }) => {
  const actions = usePersonActions();
  const start = useMemo(() => toInput(person, defaultBuys), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [f, setF] = useState<PersonInput>(start);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const twin = personWithPhone(people, f.phone, person?.key);
  const first = twin?.name.split(/\s+/)[0] ?? '';
  const dirty = JSON.stringify(f) !== JSON.stringify(start);

  const set = (patch: Partial<PersonInput>) => { setF(x => ({ ...x, ...patch })); setErrors({}); };
  const bind = (k: 'name' | 'phone' | 'email' | 'address' | 'gstin' | 'notes') => ({
    value: f[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set({ [k]: e.target.value }),
  });
  const toggle = (s: Side) => set({ buys: f.buys.includes(s) ? f.buys.filter(x => x !== s) : [...f.buys, s] });
  const locked = (s: Side) => !!person && (s === 'catering' ? person.catering.length > 0 : person.sweets.length > 0);

  const save = async () => {
    const e = check(f);
    if (!f.buys.length) { toast.error('Pick Catering, Sweets or both'); return; }
    if (Object.keys(e).length) { setErrors(e); return; }
    setBusy(true);
    try {
      const key = await actions.save(f, person);
      toast.success(person ? 'Changes saved' : `${f.name.trim()} added`);
      onSaved(key);
    } catch (err: any) { toast.error(err?.message || 'Could not save'); setBusy(false); }
  };

  const err = (k: keyof Errors) => errors[k] && <span className="pp-err">{errors[k]}</span>;
  const footer = twin && !person ? (
    <>
      <button type="button" className="pp-link" onClick={save} disabled={busy}>Save as a new customer</button>
      <button type="button" className="ui-btn" onClick={onClose}>Cancel</button>
      <button type="button" className="ui-btn primary" onClick={() => onOpen(twin.key)}>Open {twin.name}</button>
    </>
  ) : (
    <>
      {person && onDelete && <button type="button" className="pp-link danger" onClick={onDelete}>Delete…</button>}
      <button type="button" className="ui-btn" onClick={onClose}>Cancel</button>
      <button type="submit" form={FORM_ID} className="ui-btn primary" disabled={busy}>{busy ? 'Saving…' : person ? 'Save changes' : 'Save customer'}</button>
    </>
  );

  return (
    <Modal title={person ? `Edit ${person.name}` : 'New customer'} onClose={onClose} width={560} dirty={dirty} busy={busy} footer={footer}>
      <p className="pp-sub">{person ? 'Changes show on new bills and quotes. Old documents keep their copy.' : 'One list for catering and sweets.'}</p>
      {twin && !person && <div className="pp-warn" role="status">A customer with {formatPhone(f.phone)} already exists: {twin.name}. Open {first} instead?</div>}
      <form id={FORM_ID} className="pp-form" onSubmit={e => { e.preventDefault(); save(); }} noValidate>
        <label className={`pp-field${person ? ' full' : ''}`}>Name
          <input autoFocus placeholder="Full name" className={errors.name ? 'bad' : ''} {...bind('name')} />{err('name')}
        </label>
        <label className="pp-field">Phone
          <input type="tel" inputMode="tel" maxLength={16} placeholder="10 digits" className={errors.phone || (twin && !person) ? 'bad' : ''} {...bind('phone')} />
          {err('phone') || (twin && !person && <span className="pp-err">Same number as {twin.name}</span>) || (twin && <span className="pp-hint">{twin.name} also uses this number</span>)}
        </label>
        <div role="group" aria-label="Buys" className={`pp-field${person ? '' : ' full'}`}>Buys
          <span className="pp-pick">
            {(['catering', 'sweets'] as Side[]).map(s => (
              <button key={s} type="button" aria-pressed={f.buys.includes(s)} disabled={locked(s)} title={locked(s) ? 'Already saved here' : undefined} onClick={() => toggle(s)}>
                {s === 'catering' ? 'Catering' : 'Sweets'}
              </button>
            ))}
          </span>
        </div>
        <label className="pp-field full">Address<input placeholder="For deliveries and invoices" {...bind('address')} /></label>
        {!person && <span className="pp-heading">More details</span>}
        {f.buys.includes('catering') && <>
          <label className="pp-field">Email<input type="email" placeholder="Optional" className={errors.email ? 'bad' : ''} {...bind('email')} />{err('email')}</label>
          {actions.hasGstin && <label className="pp-field">GSTIN
            <input maxLength={15} placeholder="For company invoices" className={`upper${errors.gstin ? ' bad' : ''}`} {...bind('gstin')} />{err('gstin')}
          </label>}
        </>}
        <label className="pp-field full">Notes<textarea rows={3} placeholder={person ? 'Anything to remember' : 'Likes less spice, always orders Kaju Katli…'} {...bind('notes')} /></label>
      </form>
    </Modal>
  );
};

export default CustomerFormModal;
