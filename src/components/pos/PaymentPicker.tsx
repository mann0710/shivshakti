import React from 'react';
import UpiPanel from './UpiPanel';
import { PosForm, Totals, PayChoice } from '../../lib/posForm';
import { cashChips } from '../../lib/payments';
import { Owed } from '../../lib/dues';
import { inr } from '../../lib/money';
import { inp, lbl, segBtn } from '../ui/styles';

interface Props {
  form: PosForm;
  totals: Totals;
  owed: Owed;
  upiNote: string;
  received: React.ReactNode; // the save button, shown inside the UPI panel
  set: (patch: Partial<PosForm>) => void;
}

const CHOICES: [PayChoice, string][] = [['cash', 'Cash'], ['upi', 'UPI'], ['split', 'Cash + UPI'], ['unpaid', 'Unpaid']];

// Cash (with change), UPI (with QR), Cash + UPI, or Unpaid for a counter bill.
const PaymentPicker: React.FC<Props> = ({ form, totals: t, owed, upiNote, received, set }) => {
  const chips = cashChips(t.due);
  const handed = Number(form.received) || 0;
  const typed = form.received && !chips.slice(1).includes(handed) ? form.received : '';
  const pick = (payment: PayChoice) => set({ payment, received: '', cash_part: '' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="pos-seg" role="group" aria-label="Payment">
        {CHOICES.map(([k, label]) => (
          <button key={k} type="button" style={segBtn(form.payment === k)} aria-pressed={form.payment === k} onClick={() => pick(k)}>{label}</button>
        ))}
      </div>

      {form.payment === 'cash' && t.due > 0 && (
        <>
          <span style={lbl}>Cash handed over</span>
          <div className="pos-cash" role="group" aria-label="Cash handed over">
            {chips.map((v, i) => (
              <button key={v} type="button" className={(i ? handed === v : handed <= t.due) ? 'on' : ''}
                onClick={() => set({ received: i ? String(v) : '' })}>{i ? inr(v) : 'Exact'}</button>
            ))}
            <input style={{ ...inp, width: 110, minHeight: 44 }} inputMode="decimal" placeholder="Other ₹" value={typed}
              aria-label="Other amount handed over" onChange={e => set({ received: e.target.value })} />
          </div>
          {t.change > 0 && <div className="pos-change" role="status"><span>Give back</span><span>{inr(t.change)}</span></div>}
        </>
      )}

      {form.payment === 'split' && t.due > 0 && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ ...lbl, flex: 1 }}>Cash part ₹ (UPI pays the rest)</span>
          <input style={{ ...inp, width: 120, minHeight: 44 }} inputMode="decimal" value={form.cash_part} placeholder="0" autoFocus
            onChange={e => set({ cash_part: e.target.value })} />
        </label>
      )}

      {t.pay.upi > 0 && <UpiPanel amount={t.pay.upi} note={upiNote} action={received} />}

      {form.payment === 'unpaid' && t.due > 0 && (
        <>
          {(!form.customer_name.trim() || !form.phone.trim()) && <div className="pos-note">Add the customer's name and mobile to keep this bill unpaid.</div>}
          {owed.amount > 0 && (
            <div className="pos-note bad" role="alert">
              {form.customer_name.trim() || 'This customer'} already owes {inr(owed.amount)} on {owed.count} bill{owed.count === 1 ? '' : 's'}.
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PaymentPicker;
