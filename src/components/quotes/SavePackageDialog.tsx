import React, { useState } from 'react';
import Modal from '../ui/Modal';
import type { Quotation } from '../../hooks/useQuotations';
import { choiceNames, courseSummary, packageLines } from './packageMenu';
import { Field } from './bits';

interface Props { q: Quotation; busy: boolean; onClose: () => void; onSave: (name: string, price: number, items: string[]) => void }

const nameOf = (q: Quotation) => [q.customer?.name, q.booking?.event_type, q.option_name].filter(Boolean).join(' · ') || q.quotation_number;

// "Save QTN-0023's menu as a package": its name, plate price and whether choices stay choices.
const SavePackageDialog: React.FC<Props> = ({ q, busy, onClose, onSave }) => {
  const items = q.items ?? [];
  const choices = choiceNames(items);
  const [name, setName] = useState(() => nameOf(q));
  const [price, setPrice] = useState(q.per_plate_amount > 0 ? String(q.per_plate_amount) : '');
  const [keep, setKeep] = useState(true);
  const [tried, setTried] = useState(false);
  const plate = parseFloat(price) || 0;
  const bad = { name: name.trim() ? '' : 'Type a name', price: plate > 0 ? '' : 'Type the price per plate' };
  const save = () => { setTried(true); if (!bad.name && !bad.price) onSave(name.trim(), plate, packageLines(items, keep)); };

  return (
    <Modal title={`Save ${q.quotation_number}'s menu as a package`} onClose={onClose} busy={busy} width={480}
      footer={<><button type="button" className="ui-btn" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className="ui-btn primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save package'}</button></>}>
      <p className="q-dlg-sub">From a quotation you liked · {courseSummary(items)}</p>
      <div className="q-fields">
        <Field label="Package name" hint={tried && bad.name}>
          <input value={name} aria-invalid={tried && !!bad.name} onChange={e => setName(e.target.value)} />
        </Field>
        <Field label="Price per plate" hint={tried && bad.price}>
          <input value={price ? `₹${price}` : ''} inputMode="decimal" placeholder="₹" aria-invalid={tried && !!bad.price} onChange={e => setPrice(e.target.value.replace(/[^\d.]/g, ''))} />
        </Field>
      </div>
      {choices.length > 0 && (
        <label className="q-check"><input type="checkbox" checked={keep} onChange={e => setKeep(e.target.checked)} />
          Keep {choices.join(' and ')} as {choices.length > 1 ? 'choices' : 'a choice'}</label>
      )}
      <p className="q-hint">Price by number of guests can be added on the Packages page.</p>
    </Modal>
  );
};

export default SavePackageDialog;
