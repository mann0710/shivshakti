import React, { useState } from 'react';
import Modal from '../ui/Modal';
import UpiPanel from './UpiPanel';
import { PayMode } from '../../lib/payments';
import { inr } from '../../lib/money';
import { roundMoney } from '../../lib/units';
import { inp, lbl } from '../ui/styles';

interface Props {
  title: string;
  info: React.ReactNode;
  due: number;
  busy: boolean;
  upiNote: string;
  verb?: string;          // "Collect" or "Hand over"
  allowNothing?: boolean; // hand over without taking money now
  onPay: (amount: number, mode: PayMode) => void;
  onClose: () => void;
}

// Take all or part of what is due by cash or UPI; anything short stays due.
const CollectModal: React.FC<Props> = ({ title, info, due, busy, upiNote, verb = 'Collect', allowNothing, onPay, onClose }) => {
  const [amount, setAmount] = useState(String(due));
  const [qr, setQr] = useState(false);
  const value = Math.min(due, Math.max(0, roundMoney(Number(amount) || 0)));
  const short = roundMoney(due - value);

  return (
    <Modal title={title} onClose={onClose} width={420} footer={<button type="button" className="ui-btn" onClick={onClose}>Cancel</button>}>
      <div style={{ fontSize: 13, marginBottom: 10 }}>{info}</div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
        <span style={lbl}>Amount received now (₹)</span>
        <input style={{ ...inp, minHeight: 44, fontSize: 16 }} inputMode="decimal" value={amount} autoFocus
          onChange={e => setAmount(e.target.value)} onFocus={e => e.target.select()} />
      </label>
      {short > 0 && (
        <div className="pos-note" style={{ marginBottom: 10 }}>{inr(short)} stays due. It shows under Bills → Unpaid to collect later.</div>
      )}
      {value > 0 && (qr
        ? <div style={{ marginBottom: 10 }}><UpiPanel amount={value} note={upiNote} /></div>
        : <button type="button" className="ui-btn quiet" style={{ marginBottom: 10 }} onClick={() => setQr(true)}>Show UPI QR</button>)}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {value > 0 ? (['cash', 'upi'] as PayMode[]).map(m => (
          <button key={m} type="button" className="ui-btn primary" style={{ flex: 1, minHeight: 48 }} disabled={busy} onClick={() => onPay(value, m)}>
            {verb} · {m === 'upi' ? 'UPI' : 'Cash'} {inr(value)}
          </button>
        )) : allowNothing && (
          <button type="button" className="ui-btn primary" style={{ flex: 1, minHeight: 48 }} disabled={busy} onClick={() => onPay(0, 'cash')}>
            {verb} · {due > 0 ? 'nothing paid now' : 'fully paid'}
          </button>
        )}
      </div>
    </Modal>
  );
};

export default CollectModal;
