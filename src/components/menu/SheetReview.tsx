import React, { useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import { plural } from '../../lib/menuCatalog';
import { Change, FIELD_LABEL, summary } from '../../lib/menuSheet';
import { IMPORT_DAYS } from '../../lib/recycleBin';
import '../../styles/settings.css';
import '../../styles/menu-sheet.css';

interface Props { changes: Change[]; title: string; canUndo: boolean; onClose: () => void; onSave: (progress: (done: number) => void) => Promise<void> }

// Every pending change, old → new per dish, then one Save for all of them.
const SheetReview: React.FC<Props> = ({ changes, title, canUndo, onClose, onSave }) => {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [error, setError] = useState('');
  const byDish = useMemo(() => {
    const m = new Map<string, Change[]>();
    changes.forEach(c => m.set(c.id, [...(m.get(c.id) ?? []), c]));
    return Array.from(m.values());
  }, [changes]);
  const n = changes.length;

  const save = async () => {
    setBusy(true); setError(''); setDone(0);
    try { await onSave(setDone); }
    catch (e: any) { setError(e?.message || 'Could not save'); setBusy(false); }
  };

  return (
    <Modal title={`Review ${plural(n, 'change')}`} onClose={onClose} width={560} busy={busy} footer={<>
      <span className="ms-review-state" role="status">
        {busy ? `Saving ${done} of ${plural(byDish.length, 'dish', 'dishes')}…` : error && <span className="err">{error}. Anything that saved is off this list; try again for the rest.</span>}
      </span>
      <button type="button" className="ui-btn" onClick={onClose} disabled={busy}>Back to sheet</button>
      <button type="button" className="ui-btn primary" onClick={save} disabled={busy || !n}>{busy ? 'Saving…' : `Save ${plural(n, 'change')}`}</button>
    </>}>
      <p className="st-sub">{summary(changes)} in {title}.{canUndo && ` You can undo it from Settings › Data › Recycle bin for ${IMPORT_DAYS} days.`}</p>
      <ul className="ms-review">
        {byDish.map(list => (
          <li key={list[0].id}>
            <b>{list[0].dish}</b>
            {list.map(c => (
              <span key={c.field} className="ms-change">
                <span>{FIELD_LABEL[c.field]}</span>
                <span><s>{c.from}</s> <span aria-hidden="true">→</span><span className="st-sr">changes to</span> <strong>{c.to}</strong></span>
              </span>
            ))}
          </li>
        ))}
      </ul>
    </Modal>
  );
};

export default SheetReview;
