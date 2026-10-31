import React, { useState } from 'react';
import PaymentPicker from './PaymentPicker';
import BookingFields from './BookingFields';
import { PosForm, Totals } from '../../lib/posForm';
import { Owed } from '../../lib/dues';
import { inr } from '../../lib/money';
import { inp, segBtn, segWrap, NAVY, SUCCESS } from '../ui/styles';

interface Props {
  form: PosForm;
  totals: Totals;
  owed: Owed;
  upiNote: string;
  received: React.ReactNode;
  set: (patch: Partial<PosForm>) => void;
}

const Row: React.FC<{ label: string; value: string; strong?: boolean; color?: string }> = ({ label, value, strong, color }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: strong ? 17 : 13, fontWeight: strong ? 700 : 400, color: color ?? (strong ? NAVY : '#444') }}>
    <span>{label}</span><span>{value}</span>
  </div>
);

// Discount and note behind "+" buttons, the totals, then payment (bill) or pickup and advance (pre-booking).
const CheckoutFields: React.FC<Props> = ({ form, totals, owed, upiNote, received, set }) => {
  const [showDiscount, setShowDiscount] = useState(!!form.discount);
  const [showNote, setShowNote] = useState(!!form.notes);
  const before = form.paid_before ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '0.5px solid #E5E5E0', paddingTop: 10 }}>
      {(!showDiscount || !showNote) && (
        <div className="pos-tools">
          {!showDiscount && <button type="button" className="ui-btn quiet" onClick={() => setShowDiscount(true)}>+ Discount</button>}
          {!showNote && <button type="button" className="ui-btn quiet" onClick={() => setShowNote(true)}>+ Note</button>}
        </div>
      )}
      {showDiscount && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, color: '#444', flex: 1 }}>Discount</span>
          <div style={segWrap}>
            {(['amount', 'percentage'] as const).map(k => (
              <button key={k} type="button" style={{ ...segBtn(form.discount_type === k), minHeight: 44, minWidth: 44 }} aria-pressed={form.discount_type === k}
                onClick={() => set({ discount_type: k })}>{k === 'amount' ? '₹' : '%'}</button>
            ))}
          </div>
          <input style={{ ...inp, width: 90, minHeight: 44 }} inputMode="decimal" value={form.discount} placeholder="0" aria-label="Discount" autoFocus={!form.discount}
            onChange={e => set({ discount: e.target.value })} />
        </div>
      )}
      {showNote && (
        <input style={{ ...inp, minHeight: 44 }} value={form.notes} placeholder="Note on the bill" aria-label="Note" autoFocus={!form.notes}
          onChange={e => set({ notes: e.target.value })} />
      )}

      {totals.discount > 0 && <Row label="Subtotal" value={inr(totals.subtotal)} />}
      {totals.discount > 0 && <Row label="You save" value={`-${inr(totals.discount)}`} color={SUCCESS} />}
      <Row label="Total" value={inr(totals.total)} strong />
      {form.mode === 'bill' && before > 0 && <Row label="Paid before" value={inr(before)} />}
      {form.mode === 'bill' && before > 0 && totals.due > 0 && <Row label="Due now" value={inr(totals.due)} strong />}
      {totals.refund > 0 && <div className="pos-change" role="status"><span>Give back</span><span>{inr(totals.refund)}</span></div>}

      {form.mode === 'bill'
        ? (totals.due > 0 || !before) && <PaymentPicker form={form} totals={totals} owed={owed} upiNote={upiNote} received={received} set={set} />
        : <BookingFields form={form} totals={totals} set={set} />}
    </div>
  );
};

export default CheckoutFields;
