import React, { useState } from 'react';
import { todayIST } from '../../lib/ist';
import { amountOf } from '../../lib/invoiceEdit';
import { QuickPick } from '../../lib/bookingMoney';
import { Picks } from '../money/MoneyUi';

export type PayModeName = 'cash' | 'upi' | 'bank_transfer' | 'cheque';
export interface PayDraft { amount: string; payment_mode: PayModeName; notes: string; payment_date: string }

export const blankPay = (amount = 0, mode: PayModeName = 'cash'): PayDraft => ({ amount: amount > 0 ? String(amount) : '', payment_mode: mode, notes: '', payment_date: todayIST() });
export const PAY_MODES: [PayModeName, string][] = [['cash', 'Cash'], ['upi', 'UPI'], ['bank_transfer', 'Bank'], ['cheque', 'Cheque']];
export const modeLabel = (m: string) => PAY_MODES.find(x => x[0] === m)?.[1] ?? m;

// "66675.5" -> "66,675.5" while typing.
export const grouped = (text: string) => {
  const [whole, dec] = text.split('.');
  return `${Number(whole || 0).toLocaleString('en-IN')}${dec !== undefined ? `.${dec}` : ''}`;
};

interface Props { value: PayDraft; onChange: (v: PayDraft) => void; picks: QuickPick[]; error?: string; label?: string; picksHint?: string; open?: boolean; autoFocus?: boolean }

// Amount with quick picks and how it was paid; date and note behind "More details".
const PaymentFields: React.FC<Props> = ({ value, onChange, picks, error, label = 'Amount', picksHint, open, autoFocus = true }) => {
  const [more, setMore] = useState(!!open || value.payment_date !== todayIST() || !!value.notes);
  const set = <K extends keyof PayDraft>(key: K, v: PayDraft[K]) => onChange({ ...value, [key]: v });
  return (
    <>
      <label className={`mx-field${error ? ' bad' : ''}`}>{label}
        <input className="big" inputMode="decimal" autoFocus={autoFocus} value={value.amount ? `₹${grouped(value.amount)}` : ''} placeholder="₹"
          onChange={e => set('amount', e.target.value.replace(/[^\d.]/g, ''))} aria-invalid={!!error} />
        {error && <span className="mx-err" role="alert">{error}</span>}
      </label>
      {picks.length > 0 && (
        <div role="group" aria-label="Quick amounts" className="mx-field">
          <span>Quick amounts</span>
          <span className="mx-picks">
            {picks.map(q => (
              <button key={q.label} type="button" className="mx-pick" aria-pressed={amountOf(value.amount) === q.value} onClick={() => set('amount', String(q.value))}>{q.label}</button>
            ))}
          </span>
          {picksHint && <span className="mx-hint">{picksHint}</span>}
        </div>
      )}
      <Picks label="Paid by" options={PAY_MODES} value={value.payment_mode} onPick={m => set('payment_mode', m)} />
      {more ? (
        <div className="mx-grid2">
          <label className="mx-field">Date
            <input type="date" value={value.payment_date} max={todayIST()} onChange={e => set('payment_date', e.target.value)} />
          </label>
          <label className="mx-field">Note
            <input value={value.notes} placeholder="UPI ref, cheque no." onChange={e => set('notes', e.target.value)} />
          </label>
        </div>
      ) : (
        <button type="button" className="mx-link" style={{ alignSelf: 'flex-start' }} onClick={() => setMore(true)}>＋ Date, UPI ref or note</button>
      )}
    </>
  );
};

// "Send a receipt on WhatsApp", off with a reason when there is no mobile number.
export const ReceiptCheck: React.FC<{ phone?: string; on: boolean; onChange: (on: boolean) => void }> = ({ phone, on, onChange }) => {
  const ok = (phone ?? '').replace(/\D/g, '').length >= 10;
  return (
    <label className={`mx-check${ok ? '' : ' off'}`}>
      <input type="checkbox" checked={ok && on} disabled={!ok} onChange={e => onChange(e.target.checked)} />
      <span>Send a receipt on WhatsApp{!ok && <span className="mx-hint"> · add a mobile number to send one</span>}</span>
    </label>
  );
};

export default PaymentFields;
