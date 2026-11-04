import React from 'react';
import MoreMenu, { MenuItem } from '../pos/MoreMenu';
import { BillRow, STAGE_LABEL } from '../../lib/billList';
import { formatDay } from '../../lib/sessionalReceipts';
import { MODE_LABEL } from '../../lib/payments';
import { formatLineSize } from '../../lib/units';
import { inr } from '../../lib/money';
import { card, pill, NAVY, NAVY_SOFT, DANGER, SUCCESS, AMBER, STAGE_COLOR } from '../ui/styles';

interface Props {
  row: BillRow;
  occasion?: string;
  overdue: boolean;
  menu: MenuItem[];
  onCollect?: () => void;
  onRemind?: () => void;
  onPrint: () => void;
  onPdf: () => void;
  onShare?: () => void;
}

const GREY = { bg: '#F1F1EC', color: '#4A4A45' };

// Paid / part paid / unpaid as a coloured chip.
function payChip(r: BillRow) {
  if (r.cancelled) return null;
  if (!r.due) return { text: `Paid${r.mode ? ` · ${MODE_LABEL[r.mode]}` : ''}`, bg: '#EAF3DE', color: SUCCESS };
  return r.paid > 0 ? { text: 'Part paid', bg: '#FFF4E5', color: AMBER } : { text: 'Unpaid', bg: '#FEECEC', color: DANGER };
}

// One sale: a stage-coloured edge, kind / stage / payment chips, money split and its invoice and actions (rarer ones under ⋯ More).
const BillCard: React.FC<Props> = ({ row: r, occasion, overdue, menu, onCollect, onRemind, onPrint, onPdf, onShare }) => {
  const stage = STAGE_COLOR[r.stage];
  const pay = payChip(r);
  const packs = r.lines.reduce((s, l) => s + l.qty, 0);
  const when = r.kind === 'bill' ? `Billed ${formatDay(r.at)}`
    : r.stage === 'given' ? `Handed over ${formatDay(r.day)}` : r.pickup ? `Pickup ${formatDay(r.pickup)}` : `Booked ${formatDay(r.at)}`;
  return (
    <div className={`bill-card${r.cancelled ? ' void' : ''}`} style={{ ...card, padding: 14, marginBottom: 0, '--stage': stage.color } as React.CSSProperties}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>
            <span style={{ color: '#5A5A55', fontWeight: 500 }}>#{r.number}</span> {r.name}
          </div>
          <div style={{ fontSize: 12, color: '#5A5A55' }}>{[r.phone, r.address].filter(Boolean).join(' · ')}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: overdue ? DANGER : '#3A3A36', marginTop: 2 }}>{overdue ? `Overdue · ${when}` : when}</div>
          <div className="bill-chips">
            <span style={pill(r.kind === 'bill' ? GREY.bg : NAVY_SOFT, r.kind === 'bill' ? GREY.color : NAVY)}>{r.kind === 'bill' ? 'Counter bill' : 'Pre-booking'}</span>
            <span style={pill(stage.bg, stage.color)}>{r.cancelled && r.cancelReason ? `Cancelled · ${r.cancelReason}` : STAGE_LABEL[r.stage]}</span>
            {pay && <span style={pill(pay.bg, pay.color)}>{pay.text}</span>}
            {occasion && <span style={pill('#F5F5F0', '#5A5A55')}>{occasion}</span>}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="amt" style={{ fontSize: 17, fontWeight: 700, color: NAVY }}>{inr(r.total)}</div>
          {!r.cancelled && (
            <div className="bill-money">
              {r.paid > 0 && <span style={{ color: SUCCESS }}>Received {inr(r.paid)}</span>}
              {r.due > 0 && <b style={{ color: r.paid > 0 ? AMBER : DANGER }}>Due {inr(r.due)}</b>}
            </div>
          )}
        </div>
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: '#4A4A45', lineHeight: 1.6 }}>
        <b style={{ marginRight: 8 }}>{r.lines.length} item{r.lines.length === 1 ? '' : 's'} · {packs} pack{packs === 1 ? '' : 's'}</b>
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
