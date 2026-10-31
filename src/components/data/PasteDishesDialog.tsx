import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import type { Dish } from '../../lib/menuCatalog';
import { PasteRow, pasteSummary, pasteWrites, planPaste } from '../../lib/importDishes';
import { Tone, plural, rupees } from '../../lib/importPlan';
import { KINDS } from './importKinds';
import { UNDO_HINT, errorText, newId, useSaveImport } from './saveImport';
import '../../styles/import.css';

// Add many dishes to one subcategory from a list pasted out of WhatsApp or Excel.

interface Props { sub: { id: string; name: string }; dishes: Dish[]; onClose: () => void }

const CHIP: Record<PasteRow['kind'], { label: string; tone: Tone }> = {
  new: { label: 'New', tone: 'new' },
  price: { label: 'Update price', tone: 'changed' },
  same: { label: 'Same', tone: 'same' },
  twice: { label: 'Listed twice', tone: 'same' },
};

const priceText = (r: PasteRow) => {
  if (r.kind === 'price') return `${rupees(r.old)} → ${rupees(r.price)}`;
  if (r.kind === 'same') return `${rupees(r.old)} · already saved`;
  if (r.kind === 'twice') return 'left out';
  return rupees(r.price);
};

const PasteDishesDialog: React.FC<Props> = ({ sub, dishes, onClose }) => {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const { save, canUndo } = useSaveImport(KINDS.dishes.keys);
  const rows = useMemo(() => planPaste(text, sub.id, dishes), [text, sub.id, dishes]);
  const added = rows.filter(r => r.kind === 'new').length;
  const updated = rows.filter(r => r.kind === 'price').length;
  const action = [added ? `Add ${added}` : '', updated ? `${added ? 'update' : 'Update'} ${updated}` : ''].filter(Boolean).join(' · ');

  const run = async () => {
    setBusy(true);
    try {
      await save(pasteWrites(rows, sub.id, newId), `Pasted ${plural(added + updated, 'dish', 'dishes')} into ${sub.name}`);
      const done = [added ? `added ${plural(added, 'dish', 'dishes')}` : '', updated ? `updated ${plural(updated, 'price')}` : ''].filter(Boolean).join(' · ');
      toast.success(`${done.charAt(0).toUpperCase()}${done.slice(1)}${canUndo ? ` · ${UNDO_HINT}` : ''}`);
      onClose();
    } catch (e) {
      toast.error(errorText(e));
      setBusy(false);
    }
  };

  return (
    <Modal title={`Add many dishes to ${sub.name}`} onClose={onClose} width={760} dirty={!!text.trim()} busy={busy} footer={<>
      <span className="pl-sum" role="status">{rows.length ? pasteSummary(rows) : ''}</span>
      <button type="button" className="ui-btn" onClick={onClose} disabled={busy}>Cancel</button>
      <button type="button" className="ui-btn primary" onClick={run} disabled={busy || !action}>{busy ? 'Saving…' : action || 'Add dishes'}</button>
    </>}>
      <div className="pl-grid">
        <label className="pl-paste">
          Paste from WhatsApp or Excel — one dish per line, price at the end if you have it
          <textarea value={text} onChange={e => setText(e.target.value)} spellCheck={false}
            placeholder={'Raj Kachori 60\nPapdi Chaat 45\nDahi Puri - 50\nMoong Dal Chilla'} />
        </label>
        <section className="pl-preview" aria-labelledby="pl-preview-h">
          <h3 id="pl-preview-h">What will happen</h3>
          {rows.length ? (
            <ul>
              {rows.map(r => (
                <li key={r.line} className={r.kind === 'twice' ? 'off' : ''}>
                  <span className={`im-chip ${CHIP[r.kind].tone}`}>{CHIP[r.kind].label}</span>
                  <span className="pl-name">{r.name}</span>
                  <span className="pl-price">{priceText(r)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="pl-empty">Each line shows here before anything is saved: new dishes, price updates and dishes already in {sub.name}.</p>}
        </section>
      </div>
    </Modal>
  );
};

export default PasteDishesDialog;
