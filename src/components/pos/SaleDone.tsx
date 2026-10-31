import React from 'react';
import { printReceipt, shareReceipt } from '../../lib/sessionalReceipts';
import { SweetReceipt } from '../../lib/thermalSlips';
import { inr } from '../../lib/money';
import { SUCCESS, NAVY } from '../ui/styles';

interface Props {
  receipt: SweetReceipt;
  change: number;
  onNext: () => void;
}

// Shown after a bill is saved: change to give, print, share and start the next customer.
const SaleDone: React.FC<Props> = ({ receipt, change, onNext }) => {
  const p = receipt.pay;
  const paid = [p?.cash ? `Cash ${inr(p.cash)}` : '', p?.upi ? `UPI ${inr(p.upi)}` : ''].filter(Boolean).join(' · ');
  return (
    <div style={{ textAlign: 'center', padding: '18px 6px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: SUCCESS }}>✓ {receipt.kind} #{receipt.number} saved</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: NAVY }}>{inr(receipt.total)}</div>
      <div style={{ fontSize: 12, color: '#5A5A55' }}>{receipt.customer_name} · {paid || receipt.status}</div>
      {change > 0 && <div className="pos-change" role="status" style={{ justifyContent: 'center', gap: 8 }}>Give back {inr(change)}</div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 6 }}>
        <button type="button" className="ui-btn" onClick={() => printReceipt(receipt)}>Print</button>
        {receipt.phone && <button type="button" className="ui-btn" onClick={() => shareReceipt(receipt)}>WhatsApp</button>}
      </div>
      <button type="button" className="pos-charge" style={{ marginTop: 8 }} onClick={onNext} autoFocus>New bill</button>
    </div>
  );
};

export default SaleDone;
