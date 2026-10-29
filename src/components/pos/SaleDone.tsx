import React from 'react';
import { ReceiptData } from '../../lib/receipt';
import { printReceipt, shareReceipt } from '../../lib/sessionalReceipts';
import { inr } from '../../lib/money';
import { btnGhost, SUCCESS } from '../ui/styles';

interface Props {
  receipt: ReceiptData;
  change: number;
  onNext: () => void;
}

// Shown after a bill is saved: print, share and start the next customer.
const SaleDone: React.FC<Props> = ({ receipt, change, onNext }) => (
  <div style={{ textAlign: 'center', padding: '18px 6px', display: 'flex', flexDirection: 'column', gap: 10 }}>
    <div style={{ fontSize: 34 }}>✅</div>
    <div style={{ fontSize: 15, fontWeight: 700 }}>{receipt.kind} #{receipt.number} saved</div>
    <div style={{ fontSize: 26, fontWeight: 800, color: '#1A237E' }}>{inr(receipt.total)}</div>
    <div style={{ fontSize: 12, color: '#666' }}>{receipt.customer_name} · {receipt.status}</div>
    {change > 0 && <div style={{ fontSize: 15, fontWeight: 700, color: SUCCESS }}>Return {inr(change)} change</div>}
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 6 }}>
      <button type="button" style={btnGhost} onClick={() => printReceipt(receipt)}>🖨 Print</button>
      {receipt.phone && <button type="button" style={{ ...btnGhost, color: '#128C7E' }} onClick={() => shareReceipt(receipt)}>WhatsApp</button>}
    </div>
    <button type="button" className="pos-charge" style={{ marginTop: 8 }} onClick={onNext} autoFocus>New bill</button>
  </div>
);

export default SaleDone;
