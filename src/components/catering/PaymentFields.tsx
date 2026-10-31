import React from 'react';
import { todayIST } from '../../lib/ist';
import { quickAmounts, amountOf } from '../../lib/invoiceEdit';
import { Picks } from '../money/MoneyUi';

export type PayModeName = 'cash' | 'upi' | 'bank_transfer' | 'cheque';
export interface PayDraft { amount: string; payment_mode: PayModeName; notes: string; payment_date: string }

export const blankPay = (amount = 0): PayDraft => ({ amount: amount > 0 ? String(amount) : '', payment_mode: 'cash', notes: '', payment_date: todayIST() });
export const PAY_MODES: [PayModeName, string][] = [['cash', 'Cash'], ['upi', 'UPI'], ['bank_transfer', 'Bank'], ['cheque', 'Cheque']];
export const modeLabel = (m: string) => PAY_MODES.find(x => x[0] === m)?.[1] ?? m;

// "66675.5" -> "66,675.5" while typing.
export const grouped = (text: string) => {
  const [whole, dec] = text.split('.');
  return `${Number(whole || 0).toLocaleString('en-IN')}${dec !== undefined ? `.${dec}` : ''}`;
};

interface Props { value: PayDraft; onChange: (v: PayDraft) => void; balance: number; error?: string }

// Amount with quick picks, how it was paid, date and note (DlgMoney "Payment from …").
const PaymentFields: React.FC<Props> = ({ value, onChange, balance, error }) => {
  const set = <K extends keyof PayDraft>(key: K, v: PayDraft[K]) => onChange({ ...value, [key]: v });
  const quick = quickAmounts(balance);
  return (
    <>
      <label className={`mx-field${error ? ' bad' : ''}`}>Amount
        <input className="big" inputMode="decimal" autoFocus value={value.amount ? `₹${grouped(value.amount)}` : ''} placeholder="₹"
          onChange={e => set('amount', e.target.value.replace(/[^\d.]/g, ''))} aria-invalid={!!error} />
        {error && <span className="mx-err">{error}</span>}
      </label>
      {quick.length > 0 && (
        <div role="group" aria-label="Quick amounts" className="mx-field">
          <span>Quick amounts</span>
          <span className="mx-picks">
            {quick.map(q => (
              <button key={q.label} type="button" className="mx-pick" aria-pressed={amountOf(value.amount) === q.value} onClick={() => set('amount', String(q.value))}>{q.label}</button>
            ))}
          </span>
        </div>
      )}
      <Picks label="Paid by" options={PAY_MODES} value={value.payment_mode} onPick={m => set('payment_mode', m)} />
      <div className="mx-grid2">
        <label className="mx-field">Date
          <input type="date" value={value.payment_date} max={todayIST()} onChange={e => set('payment_date', e.target.value)} />
        </label>
        <label className="mx-field">Note
          <input value={value.notes} placeholder="Optional" onChange={e => set('notes', e.target.value)} />
        </label>
      </div>
    </>
  );
};

export default PaymentFields;
