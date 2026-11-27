import React, { useState } from 'react';
import Modal from '../ui/Modal';
import type { Quotation, QuoteRevision } from '../../hooks/useQuotations';
import { revisionChanges } from '../../lib/quoteRevisions';
import { inr } from '../../lib/money';
import { SumRow } from './bits';

interface Props {
  now: Quotation;
  last?: QuoteRevision;          // the accepted version kept when changing started; none before the revisions update
  paid: number;
  who: string;
  busy: boolean;
  onKeep: (send: boolean) => void;
  onUndo: () => void;
  onClose: () => void;
}

// Done changing an accepted quote: what changed, was / now / paid, then keep (and send) or undo it all.
const ReviseDialog: React.FC<Props> = ({ now, last, paid, who, busy, onKeep, onUndo, onClose }) => {
  const [send, setSend] = useState(false);
  const before = last ? { ...(last.quote as Partial<Quotation>), booking: last.booking as Quotation['booking'] } : undefined;
  const lines = before ? revisionChanges(before, now) : [];
  return (
    <Modal title={`Save changes to ${now.quotation_number}?`} onClose={onClose} width={520} busy={busy}
      footer={<>
        {last && <button type="button" className="q-link danger" onClick={onUndo} disabled={busy}>Undo all changes</button>}
        <button type="button" className="ui-btn" onClick={onClose} disabled={busy}>Keep editing</button>
        <button type="button" className="ui-btn primary" onClick={() => onKeep(send)} disabled={busy}>{last ? `Keep as revision ${last.n + 1}` : 'Keep changes'}</button>
      </>}>
      {before && <>
        <div className="q-h">What changed</div>
        {lines.length ? lines.map(l => <p key={l} className="q-hint" style={{ margin: '2px 0' }}>{l}</p>) : <p className="q-hint">Nothing that changes the price or guests.</p>}
      </>}
      <div className="q-rows">
        {last && <SumRow k={`Was (revision ${last.n})`} v={inr(last.total)} />}
        <SumRow k="Now" v={inr(now.total_amount)} tone="total" />
        <SumRow k="Already paid" v={inr(paid)} />
        <SumRow k="Still to collect" v={inr(Math.max(0, now.total_amount - paid))} />
      </div>
      <label className="q-check"><input type="checkbox" checked={send} onChange={e => setSend(e.target.checked)} />
        <span className="t"><b>Send {who} the updated quote</b><small>Opens Send with the message first</small></span></label>
    </Modal>
  );
};

export default ReviseDialog;
