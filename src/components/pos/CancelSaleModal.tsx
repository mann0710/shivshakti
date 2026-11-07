import React, { useState } from 'react';
import Modal from '../ui/Modal';
import { Refund } from '../../lib/cancelSale';
import { PayMode, MODE_LABEL } from '../../lib/payments';
import { inr } from '../../lib/money';
import { inp, lbl, segBtn, segWrap } from '../ui/styles';

interface Props {
  noun: 'bill' | 'pre-booking';
  number: string;
  name: string;
  // What can be given back (received so far) and the usual mode.
  refund: Refund;
  busy: boolean;
  onCancel: (reason: string, refund: Refund | null) => void;
  onClose: () => void;
}

const REASONS = ['Customer changed mind', 'Wrong items', 'Entered twice', 'Not collected'];
const MODES: PayMode[] = ['cash', 'upi'];

// Cancelling keeps the sale and its number, marked cancelled with the reason; any money given back is recorded.
const CancelSaleModal: React.FC<Props> = ({ noun, number, name, refund, busy, onCancel, onClose }) => {
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState(String(refund.amount || ''));
  const [mode, setMode] = useState<PayMode>(refund.mode);
  const back = Math.min(refund.amount, Math.max(0, Number(amount) || 0));
  const ok = !!reason.trim() && !busy && Number(amount || 0) <= refund.amount;
  return (
    <Modal title={`Cancel ${noun} #${number}?`} onClose={onClose} width={420} busy={busy}
      footer={<>
        <button type="button" className="ui-btn" onClick={onClose}>Keep it</button>
        <button type="button" className="ui-btn danger" disabled={!ok} onClick={() => onCancel(reason.trim(), back > 0 ? { amount: back, mode } : null)}>Cancel {noun}</button>
      </>}>
      <div style={{ fontSize: 13, marginBottom: 10 }}>{name}'s {noun} keeps its number and shows as cancelled. It leaves sales, reports and dues. Nothing is deleted.</div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={lbl}>Reason *</span>
        <input style={{ ...inp, minHeight: 44 }} value={reason} autoFocus onChange={e => setReason(e.target.value)} placeholder="Why is it cancelled?" />
      </label>
      <div className="pos-tools" style={{ marginTop: 8 }}>
        {REASONS.map(r => <button key={r} type="button" className="ui-btn quiet" onClick={() => setReason(r)}>{r}</button>)}
      </div>
      {refund.amount > 0 && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={lbl}>Given back to the customer (received {inr(refund.amount)}; leave 0 if kept)</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={{ ...inp, minHeight: 44, flex: 1 }} type="number" inputMode="decimal" min={0} max={refund.amount} value={amount}
              aria-label="Refund amount" onChange={e => setAmount(e.target.value)} />
            <div style={segWrap} role="group" aria-label="Refund mode">
              {MODES.map(m => <button key={m} type="button" style={{ ...segBtn(mode === m), minHeight: 44 }} aria-pressed={mode === m} onClick={() => setMode(m)}>{MODE_LABEL[m]}</button>)}
            </div>
          </div>
          {Number(amount) > refund.amount && <span style={{ fontSize: 12, color: '#B3261E' }}>Can't give back more than {inr(refund.amount)}.</span>}
        </div>
      )}
    </Modal>
  );
};

export default CancelSaleModal;
