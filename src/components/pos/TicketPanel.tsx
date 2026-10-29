import React from 'react';
import type { SeasonalCustomer } from '../../hooks/useSeasonalCustomers';
import { PosForm, PosMode, Totals } from '../../lib/posForm';
import { setLineQty } from '../../lib/cart';
import { inr } from '../../lib/money';
import TicketLines from './TicketLines';
import CustomerFields from './CustomerFields';
import CheckoutFields from './CheckoutFields';
import { segBtn, segWrap, btnSm, DANGER } from '../ui/styles';

interface Props {
  form: PosForm;
  totals: Totals;
  customers: SeasonalCustomer[];
  editingLabel?: string;
  busy: boolean;
  set: (patch: Partial<PosForm>) => void;
  onMode: (mode: PosMode) => void;
  onCharge: () => void;
  onClear: () => void;
  onCancelEdit?: () => void;
  formKey: number;
}

export function chargeLabel(f: PosForm, t: Totals, editing: boolean, busy: boolean) {
  if (busy) return 'Saving…';
  if (!f.lines.length) return 'Add items to start';
  if (editing) return `Save changes · ${inr(t.total)}`;
  if (f.mode === 'preorder') return `Book · ${inr(t.total)}`;
  return f.payment === 'unpaid' ? `Save unpaid · ${inr(t.total)}` : `Charge ${inr(t.total)}`;
}

// The bill: customer, lines, totals, payment and the big Charge button.
const TicketPanel: React.FC<Props> = ({ form, totals, customers, editingLabel, busy, set, onMode, onCharge, onClear, onCancelEdit, formKey }) => {
  const count = form.lines.reduce((s, l) => s + l.qty, 0);
  const needsCustomer = form.mode === 'preorder' || form.payment === 'unpaid';

  return (
    <section className="pos-panel pos-ticket" id="pos-ticket" aria-label="Bill">
      {editingLabel ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FFF8E1', borderRadius: 8, padding: '8px 10px', fontSize: 12 }}>
          <span>✏️ Editing <b>{editingLabel}</b></span>
          <button type="button" style={btnSm} onClick={onCancelEdit}>Cancel edit</button>
        </div>
      ) : (
        <div style={segWrap} role="group" aria-label="Bill type">
          <button type="button" style={segBtn(form.mode === 'bill')} onClick={() => onMode('bill')}>🧾 Counter bill</button>
          <button type="button" style={segBtn(form.mode === 'preorder')} onClick={() => onMode('preorder')}>📅 Pre-booking</button>
        </div>
      )}

      <CustomerFields key={formKey} name={form.customer_name} phone={form.phone} address={form.address}
        customers={customers} required={needsCustomer} onChange={set} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#888880' }}>
        <span>{count} item{count === 1 ? '' : 's'}</span>
        {form.lines.length > 0 && !editingLabel && (
          <button type="button" style={{ ...btnSm, color: DANGER }} onClick={onClear}>Clear bill</button>
        )}
      </div>

      <TicketLines lines={form.lines} onQty={(key, qty) => set({ lines: setLineQty(form.lines, key, qty) })} />

      <CheckoutFields form={form} totals={totals} set={set} />

      <button type="button" className="pos-charge" disabled={!form.lines.length || busy} onClick={onCharge}>
        {chargeLabel(form, totals, !!editingLabel, busy)}
      </button>
    </section>
  );
};

export default TicketPanel;
