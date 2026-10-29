import React from 'react';
import { todayIST } from '../../lib/ist';
import { inp, lbl } from './InvoiceUi';

export interface PayDraft { amount: string; payment_type: 'advance' | 'partial'; payment_mode: string; notes: string; payment_date: string }

export const blankPay = (): PayDraft => ({ amount: '', payment_type: 'advance', payment_mode: 'upi', notes: '', payment_date: todayIST() });
export const modeLabel = (m: string) => m.replace('_', ' ').toUpperCase();
const MODES = ['upi', 'cash', 'bank_transfer', 'cheque'];

interface Props { value: PayDraft; onChange: (v: PayDraft) => void; maxAmount?: number }

// Type, amount, mode, date and notes for recording or editing a payment.
const PaymentFields: React.FC<Props> = ({ value, onChange, maxAmount }) => {
  const set = <K extends keyof PayDraft>(key: K, v: PayDraft[K]) => onChange({ ...value, [key]: v });
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      <div>
        <label style={lbl}>Payment type</label>
        <select style={inp} value={value.payment_type} onChange={e => set('payment_type', e.target.value as PayDraft['payment_type'])}>
          <option value="advance">Advance</option>
          <option value="partial">Partial</option>
        </select>
      </div>
      <div>
        <label style={lbl}>Amount (₹)</label>
        <input type="number" inputMode="decimal" min="0" style={inp} value={value.amount} onChange={e => set('amount', e.target.value)}
          placeholder={maxAmount ? `Max ₹${maxAmount}` : undefined} />
      </div>
      <div>
        <label style={lbl}>Payment mode</label>
        <select style={inp} value={value.payment_mode} onChange={e => set('payment_mode', e.target.value)}>
          {MODES.map(m => <option key={m} value={m}>{modeLabel(m)}</option>)}
        </select>
      </div>
      <div>
        <label style={lbl}>Payment date</label>
        <input type="date" style={inp} value={value.payment_date} onChange={e => set('payment_date', e.target.value)} />
      </div>
      <div style={{ gridColumn: '1 / -1' }}>
        <label style={lbl}>Notes</label>
        <input style={inp} value={value.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional note" />
      </div>
    </div>
  );
};

export default PaymentFields;
