import React from 'react';
import { QuickPick } from '../../lib/bookingMoney';
import { inr } from '../../lib/money';
import PaymentFields, { PayDraft, ReceiptCheck } from './PaymentFields';

export type AdvanceKind = 'had' | 'new' | 'none';

interface Props {
  had: number;                       // already received on the booking
  kind: AdvanceKind | null;          // nothing picked until the owner chooses
  onKind: (k: AdvanceKind) => void;
  draft: PayDraft;
  onDraft: (d: PayDraft) => void;
  picks: QuickPick[];
  picksHint?: string;
  phone?: string;
  receipt: boolean;
  onReceipt: (on: boolean) => void;
  upiNote: string;
}

// Advance on confirming: money already received, a new payment, or none yet. Nothing is recorded until one is picked.
const AdvanceChoice: React.FC<Props> = ({ had, kind, onKind, draft, onDraft, picks, picksHint, phone, receipt, onReceipt, upiNote }) => {
  const cards: [AdvanceKind, string, string][] = [
    ...(had > 0 ? [['had', `Already received ${inr(had)}`, 'Nothing new to record'] as [AdvanceKind, string, string]] : []),
    ['new', 'Received a new payment', 'Type the amount and how it was paid'],
    ['none', 'No advance yet', 'Record it later from ⋯ → Record payment'],
  ];
  return (
    <div className="mx-dlg">
      <span className="mx-heading">Advance (token)</span>
      <div role="radiogroup" aria-label="Advance" className="mx-cards">
        {cards.map(([id, title, line]) => (
          <button key={id} type="button" role="radio" aria-checked={kind === id} className="mx-rcard" onClick={() => onKind(id)}>
            <i aria-hidden="true" /><span><b>{title}</b><small>{line}</small></span><span />
          </button>
        ))}
      </div>
      {kind === 'new' && <>
        <PaymentFields value={draft} onChange={onDraft} picks={picks} picksHint={picksHint} autoFocus={false} upiNote={upiNote} />
        <ReceiptCheck phone={phone} on={receipt} onChange={onReceipt} />
      </>}
    </div>
  );
};

export default AdvanceChoice;
