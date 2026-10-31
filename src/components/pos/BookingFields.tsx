import React from 'react';
import UpiPanel from './UpiPanel';
import { PosForm, Totals, PayMode } from '../../lib/posForm';
import { Fulfillment } from '../../lib/preorders';
import { inr } from '../../lib/money';
import { inp, lbl, segBtn } from '../ui/styles';

interface Props {
  form: PosForm;
  totals: Totals;
  set: (patch: Partial<PosForm>) => void;
}

const field: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 3 };

// Pickup or delivery, the date, and any advance (with a UPI QR when paid by UPI).
const BookingFields: React.FC<Props> = ({ form, totals, set }) => {
  const fulfil = form.fulfillment ?? 'pickup';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      <div className="pos-seg" style={{ gridColumn: '1 / -1' }} role="group" aria-label="Pickup or delivery">
        {(['pickup', 'delivery'] as Fulfillment[]).map(k => (
          <button key={k} type="button" style={segBtn(fulfil === k)} aria-pressed={fulfil === k} onClick={() => set({ fulfillment: k })}>
            {k === 'pickup' ? 'Pickup from shop' : 'Home delivery'}
          </button>
        ))}
      </div>
      <label style={field}>
        <span style={lbl}>{fulfil === 'pickup' ? 'Pickup date *' : 'Delivery date *'}</span>
        <input style={{ ...inp, minHeight: 44 }} type="date" value={form.delivery_date} onChange={e => set({ delivery_date: e.target.value })} />
      </label>
      <label style={field}>
        <span style={lbl}>Advance ₹</span>
        <input style={{ ...inp, minHeight: 44 }} inputMode="decimal" value={form.advance} placeholder="0" onChange={e => set({ advance: e.target.value })} />
      </label>
      {totals.advance > 0 && (
        <div className="pos-seg" style={{ gridColumn: '1 / -1' }} role="group" aria-label="Advance paid by">
          {(['cash', 'upi'] as PayMode[]).map(m => (
            <button key={m} type="button" style={segBtn(form.advance_mode === m)} aria-pressed={form.advance_mode === m} onClick={() => set({ advance_mode: m })}>
              Advance by {m === 'upi' ? 'UPI' : 'Cash'}
            </button>
          ))}
        </div>
      )}
      {totals.advance > 0 && form.advance_mode === 'upi' && (
        <div style={{ gridColumn: '1 / -1' }}><UpiPanel amount={totals.advance} note={`Advance ${form.customer_name}`.trim()} /></div>
      )}
      <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#B45309', fontWeight: 600 }}>
        <span>{fulfil === 'pickup' ? 'Balance at pickup' : 'Balance on delivery'}</span><span>{inr(totals.balance)}</span>
      </div>
    </div>
  );
};

export default BookingFields;
