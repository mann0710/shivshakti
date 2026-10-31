import React from 'react';
import MoreMenu, { MenuItem } from '../pos/MoreMenu';
import { SeasonalOrder } from '../../hooks/useSeasonalOrders';
import { billNumber } from '../../lib/receipt';
import { formatDay } from '../../lib/sessionalReceipts';
import { billDue, billPaid } from '../../lib/dues';
import { billPayments, modeOf, MODE_LABEL } from '../../lib/payments';
import { formatLineSize } from '../../lib/units';
import { inr } from '../../lib/money';
import { card, pill, NAVY, NAVY_SOFT, DANGER, SUCCESS } from '../ui/styles';

interface Props {
  order: SeasonalOrder;
  occasion?: string;
  menu: MenuItem[];
  onCollect: () => void;
  onRemind: () => void;
  onPrint: () => void;
  onShare: () => void;
}

function payState(o: SeasonalOrder): { text: string; color: string } {
  if (o.cancelled_at) return { text: `Cancelled${o.cancel_reason ? ` · ${o.cancel_reason}` : ''}`, color: DANGER };
  const due = billDue(o);
  const mode = modeOf(billPayments(o));
  if (!due) return { text: `✓ Paid · ${mode ? MODE_LABEL[mode] : 'Cash'}`, color: SUCCESS };
  const paid = billPaid(o);
  return { text: paid > 0 ? `Paid ${inr(paid)} · ${inr(due)} due` : 'Unpaid', color: DANGER };
}

// One bill: who, what, paid or due, and its actions (rarer ones under ⋯ More).
const BillCard: React.FC<Props> = ({ order: o, occasion, menu, onCollect, onRemind, onPrint, onShare }) => {
  const due = billDue(o);
  const state = payState(o);
  return (
    <div className={`bill-card${o.cancelled_at ? ' void' : ''}`} style={{ ...card, padding: 14, marginBottom: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>
            <span style={{ color: '#5A5A55', fontWeight: 500 }}>#{billNumber(o.bill_no, o.id)}</span> {o.customer_name}
          </div>
          <div style={{ fontSize: 12, color: '#5A5A55' }}>{[o.phone, o.address, formatDay(o.created_at)].filter(Boolean).join(' · ')}</div>
          {occasion && <span style={{ ...pill(NAVY_SOFT, NAVY), marginTop: 4 }}>{occasion}</span>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="amt" style={{ fontSize: 16, fontWeight: 700, color: NAVY }}>{inr(o.total_amount)}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: state.color }}>{state.text}</div>
        </div>
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: '#4A4A45', lineHeight: 1.6 }}>
        {o.items.map((it, i) => <span key={i} style={{ marginRight: 10 }}>{it.item_name} ({formatLineSize(it.weight, it.weight_unit)}) ×{it.qty}</span>)}
      </div>
      {o.notes && <div style={{ fontSize: 12, color: '#5A5A55', marginTop: 4 }}>Note: {o.notes}</div>}
      <div className="pos-tools" style={{ marginTop: 10 }}>
        {due > 0 && <button type="button" className="ui-btn primary" onClick={onCollect}>Collect {inr(due)}</button>}
        {due > 0 && o.phone && <button type="button" className="ui-btn" onClick={onRemind}>Remind</button>}
        <button type="button" className="ui-btn" onClick={onPrint}>Print</button>
        {o.phone && !o.cancelled_at && <button type="button" className="ui-btn" onClick={onShare}>WhatsApp</button>}
        <MoreMenu items={menu} />
      </div>
    </div>
  );
};

export default BillCard;
