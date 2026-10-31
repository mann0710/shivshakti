import React from 'react';
import type { SeasonalCustomer } from '../../hooks/useSeasonalCustomers';
import { PosForm, PosMode, Totals } from '../../lib/posForm';
import { Owed } from '../../lib/dues';
import { setLineQty } from '../../lib/cart';
import { inr } from '../../lib/money';
import TicketLines from './TicketLines';
import CustomerFields from './CustomerFields';
import CheckoutFields from './CheckoutFields';
import { segBtn } from '../ui/styles';

interface Props {
  form: PosForm;
  totals: Totals;
  customers: SeasonalCustomer[];
  owed: Owed;
  editingLabel?: string;
  busy: boolean;
  held: number;
  set: (patch: Partial<PosForm>) => void;
  onMode: (mode: PosMode) => void;
  onCharge: () => void;
  onClear: () => void;
  onHold: () => void;
  onShowHeld: () => void;
  onCancelEdit?: () => void;
  formKey: number;
}

export function chargeLabel(f: PosForm, t: Totals, editing: boolean, busy: boolean) {
  if (busy) return 'Saving…';
  if (!f.lines.length) return 'Add items to start';
  if (f.mode === 'preorder') return editing ? `Save changes · ${inr(t.total)}` : `Book · ${inr(t.total)}`;
  if (t.pay.upi > 0) return `Received ${inr(t.pay.upi)} · save`;
  if (t.refund > 0) return `Save · give back ${inr(t.refund)}`;
  if (t.due === 0) return editing ? `Save changes · ${inr(t.total)}` : `Save · ${inr(t.total)}`;
  if (f.payment === 'unpaid') return editing ? `Save · ${inr(t.due)} stays due` : `Save unpaid · ${inr(t.total)}`;
  return t.change > 0 ? `Charge ${inr(t.due)} · return ${inr(t.change)}` : `Charge ${inr(t.due)}`;
}

// The bill: type, customer, lines, totals, payment and the big save button.
const TicketPanel: React.FC<Props> = props => {
  const { form, totals, customers, owed, editingLabel, busy, held, set, onMode, onCharge, onClear, onHold, onShowHeld, onCancelEdit, formKey } = props;
  const count = form.lines.reduce((s, l) => s + l.qty, 0);
  const needsCustomer = form.mode === 'preorder' || form.payment === 'unpaid';
  const save = (
    <button type="button" className="pos-charge" disabled={!form.lines.length || busy} onClick={onCharge}>
      {chargeLabel(form, totals, !!editingLabel, busy)}
    </button>
  );
  const inPanel = form.mode === 'bill' && totals.pay.upi > 0;

  return (
    <section className="pos-panel pos-ticket" id="pos-ticket" aria-label="Bill">
      {editingLabel ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, background: '#FFF8E1', borderRadius: 8, padding: '6px 10px', fontSize: 12 }}>
          <span>Editing <b>{editingLabel}</b></span>
          <button type="button" className="ui-btn" onClick={onCancelEdit}>Cancel edit</button>
        </div>
      ) : (
        <div className="pos-seg" role="group" aria-label="Bill type">
          <button type="button" style={segBtn(form.mode === 'bill')} aria-pressed={form.mode === 'bill'} onClick={() => onMode('bill')}>Bill</button>
          <button type="button" style={segBtn(form.mode === 'preorder')} aria-pressed={form.mode === 'preorder'} onClick={() => onMode('preorder')}>Pre-booking</button>
        </div>
      )}

      <CustomerFields key={`who-${formKey}`} name={form.customer_name} phone={form.phone} address={form.address}
        customers={customers} required={needsCustomer} onChange={set} />

      <div className="pos-tools">
        <span className="grow">{count} item{count === 1 ? '' : 's'}</span>
        {!editingLabel && (
          <>
            <button type="button" className="ui-btn" disabled={!form.lines.length} onClick={onHold}>Hold</button>
            {held > 0 && <button type="button" className="ui-btn" onClick={onShowHeld}>Held bills {held}</button>}
            {form.lines.length > 0 && <button type="button" className="ui-btn warn" onClick={onClear}>Clear bill</button>}
          </>
        )}
      </div>

      <TicketLines lines={form.lines} onQty={(key, qty) => set({ lines: setLineQty(form.lines, key, qty) })} />

      <CheckoutFields key={`pay-${formKey}`} form={form} totals={totals} owed={owed} set={set} received={inPanel ? save : null}
        upiNote={`${form.customer_name.trim() || 'Sweets'} bill`} />

      {!inPanel && save}
    </section>
  );
};

export default TicketPanel;
