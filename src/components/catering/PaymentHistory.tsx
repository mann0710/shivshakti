import React from 'react';
import { Payment } from '../../types';
import { PlanRow } from '../../lib/invoiceEdit';
import { inr } from '../../lib/money';
import { Chip } from '../money/MoneyUi';

// No onRecord when nothing is due: the add button is hidden.
interface Props { rows: PlanRow[]; onRecord?: () => void; onEdit: (p: Payment) => void }

const TONE = { good: { bg: '#E1F5EE', fg: '#0F6E56' }, bad: { bg: '#FCEBEB', fg: '#A32D2D' }, wait: { bg: '#FAEEDA', fg: '#7A4A0A' } };

// Payments received and the balance still to come; tap a payment to change or delete it.
const PaymentHistory: React.FC<Props> = ({ rows, onRecord, onEdit }) => {
  const line = (r: PlanRow) => (<>
    <span className="when mx-sub">{r.when}</span>
    <span>{r.what}</span>
    <span className="r">{inr(r.amount)}</span>
    <Chip bg={TONE[r.tone].bg} fg={TONE[r.tone].fg}>{r.status}</Chip>
  </>);
  return (
    <section aria-label="Payments" className="iv-sec">
      <div className="iv-sec-head"><h2>Payments</h2>{onRecord && <button type="button" className="mx-link" onClick={onRecord}>+ Record payment</button>}</div>
      {!rows.length && <p className="mx-sub">No payments yet, and nothing is due.</p>}
      {rows.map(r => (r.payment
        ? <button key={r.key} type="button" className="iv-plan" onClick={() => onEdit(r.payment!)} aria-label={`Change payment of ${inr(r.amount)} on ${r.when}`}>{line(r)}</button>
        : <div key={r.key} className="iv-plan">{line(r)}</div>))}
      {rows.some(r => r.payment) && <span className="mx-sub">Tap a payment to change or delete it.</span>}
    </section>
  );
};

export default PaymentHistory;
