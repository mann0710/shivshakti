import React from 'react';
import { PosForm, Totals, PayMode } from '../../lib/posForm';
import { inr } from '../../lib/money';
import { Fulfillment } from '../../lib/preorders';
import { inp, lbl, segBtn, segWrap, NAVY, SUCCESS } from '../ui/styles';

interface Props {
  form: PosForm;
  totals: Totals;
  set: (patch: Partial<PosForm>) => void;
}

const Row: React.FC<{ label: string; value: string; strong?: boolean; color?: string }> = ({ label, value, strong, color }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: strong ? 17 : 13, fontWeight: strong ? 700 : 400, color: color ?? (strong ? NAVY : '#444') }}>
    <span>{label}</span><span>{value}</span>
  </div>
);

// Totals, discount and payment (or advance for pre-bookings).
const CheckoutFields: React.FC<Props> = ({ form, totals, set }) => {
  const bill = form.mode === 'bill';
  const fulfil = form.fulfillment ?? 'pickup';
  const pay: { key: PosForm['payment']; label: string }[] = [
    { key: 'cash', label: 'Cash' }, { key: 'upi', label: 'UPI' }, { key: 'unpaid', label: 'Unpaid' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '0.5px solid #E5E5E0', paddingTop: 10 }}>
      <Row label="Subtotal" value={inr(totals.subtotal)} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 13, color: '#444', flex: 1 }}>Discount</span>
        <div style={segWrap}>
          {(['amount', 'percentage'] as const).map(t => (
            <button key={t} type="button" style={{ ...segBtn(form.discount_type === t), padding: '5px 10px' }} onClick={() => set({ discount_type: t })}>
              {t === 'amount' ? '₹' : '%'}
            </button>
          ))}
        </div>
        <input style={{ ...inp, width: 80 }} inputMode="decimal" value={form.discount} placeholder="0" aria-label="Discount"
          onChange={e => set({ discount: e.target.value })} />
      </div>
      {totals.discount > 0 && <Row label="You save" value={`-${inr(totals.discount)}`} color={SUCCESS} />}
      <Row label="Total" value={inr(totals.total)} strong />

      {bill ? (
        <>
          <div style={segWrap} role="group" aria-label="Payment">
            {pay.map(p => (
              <button key={p.key} type="button" style={segBtn(form.payment === p.key)} aria-pressed={form.payment === p.key} onClick={() => set({ payment: p.key })}>
                {p.label}
              </button>
            ))}
          </div>
          {form.payment === 'cash' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ ...lbl, flex: 1 }}>Cash received (optional)</span>
              <input style={{ ...inp, width: 100 }} inputMode="decimal" value={form.received} placeholder={String(totals.total)}
                onChange={e => set({ received: e.target.value })} />
            </div>
          )}
          {totals.change > 0 && <Row label="Return to customer" value={inr(totals.change)} color={SUCCESS} strong />}
        </>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={{ ...segWrap, gridColumn: '1 / -1' }} role="group" aria-label="Pickup or delivery">
            {(['pickup', 'delivery'] as Fulfillment[]).map(k => (
              <button key={k} type="button" style={segBtn(fulfil === k)} aria-pressed={fulfil === k} onClick={() => set({ fulfillment: k })}>
                {k === 'pickup' ? '🏪 Pickup from shop' : '🚚 Home delivery'}
              </button>
            ))}
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={lbl}>{fulfil === 'pickup' ? 'Pickup date *' : 'Delivery date *'}</span>
            <input style={inp} type="date" value={form.delivery_date} onChange={e => set({ delivery_date: e.target.value })} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={lbl}>Advance ₹</span>
            <input style={inp} inputMode="decimal" value={form.advance} placeholder="0" onChange={e => set({ advance: e.target.value })} />
          </label>
          {totals.advance > 0 && (
            <div style={{ ...segWrap, gridColumn: '1 / -1' }}>
              {(['cash', 'upi'] as PayMode[]).map(m => (
                <button key={m} type="button" style={segBtn(form.advance_mode === m)} onClick={() => set({ advance_mode: m })}>
                  Advance by {m.toUpperCase()}
                </button>
              ))}
            </div>
          )}
          <div style={{ gridColumn: '1 / -1' }}><Row label={fulfil === 'pickup' ? 'Balance at pickup' : 'Balance on delivery'} value={inr(totals.balance)} color="#E65100" /></div>
        </div>
      )}
      <input style={inp} value={form.notes} placeholder="Note (optional)" onChange={e => set({ notes: e.target.value })} aria-label="Note" />
    </div>
  );
};

export default CheckoutFields;
