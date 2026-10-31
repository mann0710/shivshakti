import React, { useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import { Person, formatPhone, namesOf, recordsOf } from '../../lib/people';
import { undoToast } from '../pos/undoToast';
import { usePersonActions } from './usePersonActions';

interface Props { person: Person; onClose: () => void }

// Gives every saved copy one name; both lists keep their record so bookings and bills stay linked.
const CombineDialog: React.FC<Props> = ({ person, onClose }) => {
  const { combine } = usePersonActions();
  const names = namesOf(person);
  const [name, setName] = useState(names[0] ?? person.name);
  const [busy, setBusy] = useState(false);
  const records = recordsOf(person);
  const sameList = person.catering.length > 1 || person.sweets.length > 1;

  const run = async () => {
    setBusy(true);
    try {
      const undo = await combine(person, name);
      undoToast(`Combined as ${name}`, () => { undo().then(() => toast.success('Put back')).catch(e => toast.error(e?.message || 'Could not undo')); });
      onClose();
    } catch (e: any) { toast.error(e?.message || 'Could not combine'); setBusy(false); }
  };

  return (
    <Modal title={`Combine ${person.name}`} onClose={onClose} width={480} busy={busy}
      footer={<>
        <button type="button" className="ui-btn" onClick={onClose}>Cancel</button>
        <button type="button" className="ui-btn primary" onClick={run} disabled={busy}>{busy ? 'Combining…' : 'Combine'}</button>
      </>}>
      <p className="pp-sub">
        {formatPhone(person.phone)} is saved {records.length} times: {records.map(r => `${r.name} (${r.side})`).join(', ')}. Pick the name to keep.
      </p>
      <div role="radiogroup" aria-label="Name to keep" className="pp-radios">
        {names.map(n => (
          <button key={n} type="button" role="radio" aria-checked={name === n} className="pp-radio" onClick={() => setName(n)}>
            <i aria-hidden="true" />
            <span><b>{n}</b><span>{records.filter(r => r.name.trim().toLowerCase() === n.toLowerCase()).map(r => (r.side === 'catering' ? 'Catering' : 'Sweets')).join(' and ')}</span></span>
          </button>
        ))}
      </div>
      <p className="pp-sub" style={{ marginTop: 12, marginBottom: 0 }}>
        Address and notes fill in where one copy is blank. Old bills and quotes keep the name printed on them.
        {sameList ? ' Bookings stay on the copy they were made on.' : ''}
      </p>
    </Modal>
  );
};

export default CombineDialog;
