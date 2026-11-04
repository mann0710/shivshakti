import React from 'react';
import MoreMenu, { MenuItem } from '../pos/MoreMenu';
import { BillRow } from '../../lib/billList';
import { formatDay } from '../../lib/sessionalReceipts';
import { MODE_LABEL } from '../../lib/payments';
import { formatLineSize } from '../../lib/units';
import { inr } from '../../lib/money';
import { card, pill, NAVY, NAVY_SOFT, DANGER, SUCCESS } from '../ui/styles';

interface Props {
  row: BillRow;
  occasion?: string;
  menu: MenuItem[];
  onCollect?: () => void;
  onRemind?: () => void;
  onPrint: () => void;
  onPdf: () => void;
  onShare?: () => void;
}

function payState(r: BillRow): { text: string; color: string } {
  if (r.cancelled) return { text: `Cancelled${r.cancelReason ? ` · ${r.cancelReason}` : ''}`, color: DANGER };
  if (!r.due) return { text: `✓ Paid · ${r.mode ? MODE_LABEL[r.mode] : 'Cash'}`, color: SUCCESS };
  return { text: r.paid > 0 ? `Paid ${inr(r.paid)} · ${inr(r.due)} due` : 'Unpaid', color: DANGER };
}

// One sale (counter bill or pre-booking): who, what, paid or due, its invoice and actions (rarer ones under ⋯ More).
const BillCard: React.FC<Props> = ({ row: r, occasion, menu, onCollect, onRemind, onPrint, onPdf, onShare }) => {
  const state = payState(r);
  const when = r.kind === 'bill' ? formatDay(r.at) : `Pre-booking · ${r.stage}${r.pickup ? ` · pickup ${formatDay(r.pickup)}` : ''}`;
  return (
    <div className={`bill-card${r.cancelled ? ' void' : ''}`} style={{ ...card, padding: 14, marginBottom: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>
            <span style={{ color: '#5A5A55', fontWeight: 500 }}>#{r.number}</span> {r.name}
          </div>
          <div style={{ fontSize: 12, color: '#5A5A55' }}>{[r.phone, r.address, when].filter(Boolean).join(' · ')}</div>
          {occasion && <span style={{ ...pill(NAVY_SOFT, NAVY), marginTop: 4 }}>{occasion}</span>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="amt" style={{ fontSize: 16, fontWeight: 700, color: NAVY }}>{inr(r.total)}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: state.color }}>{state.text}</div>
        </div>
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: '#4A4A45', lineHeight: 1.6 }}>
        {r.lines.map((it, i) => <span key={i} style={{ marginRight: 10 }}>{it.item_name} ({formatLineSize(it.weight, it.weight_unit)}) ×{it.qty}</span>)}
      </div>
      {r.notes && <div style={{ fontSize: 12, color: '#5A5A55', marginTop: 4 }}>Note: {r.notes}</div>}
      <div className="pos-tools" style={{ marginTop: 10 }}>
        {onCollect && <button type="button" className="ui-btn primary" onClick={onCollect}>Collect {inr(r.due)}</button>}
        {onRemind && <button type="button" className="ui-btn" onClick={onRemind}>Remind</button>}
        <button type="button" className="ui-btn" onClick={onPrint}>Print invoice</button>
        <button type="button" className="ui-btn" onClick={onPdf}>Invoice PDF</button>
        {onShare && <button type="button" className="ui-btn" onClick={onShare}>WhatsApp</button>}
        <MoreMenu items={menu} />
      </div>
    </div>
  );
};

export default BillCard;
