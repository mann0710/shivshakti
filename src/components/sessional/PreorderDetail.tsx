import React from 'react';
import Modal from '../ui/Modal';
import MoreMenu from '../pos/MoreMenu';
import { SeasonalPreorder } from '../../hooks/useSeasonalPreorders';
import { usePreorderActions } from '../../hooks/usePreorderActions';
import { isOpenPreorder, isPacked, balanceOf, STATUS_LABEL } from '../../lib/preorders';
import { dueLabel } from '../../lib/preorderSheet';
import { preorderPayments, MODE_LABEL } from '../../lib/payments';
import { formatDay } from '../../lib/sessionalReceipts';
import { formatLineSize } from '../../lib/units';
import { inr } from '../../lib/money';

interface Props {
  p: SeasonalPreorder;
  occasion?: string;
  actions: ReturnType<typeof usePreorderActions>;
  onEdit: () => void;
  onPrint: () => void;
  onShare: () => void;
  onClose: () => void;
}

const KIND: Record<string, string> = { advance: 'Advance', handover: 'At hand-over', due: 'Collected later', sale: 'Paid', refund: 'Given back' };

// One booking with everything you can do to it; opened by tapping a name.
const PreorderDetail: React.FC<Props> = ({ p, occasion, actions, onEdit, onPrint, onShare, onClose }) => {
  const open = isOpenPreorder(p);
  const due = balanceOf(p);
  const then = (fn: () => void) => () => { onClose(); fn(); };
  return (
    <Modal title={p.customer_name} onClose={onClose} width={480}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
        <div style={{ color: '#5A5A55' }}>
          {[p.phone, p.address, occasion].filter(Boolean).join(' · ')}
          <div>{dueLabel(p)} · <b>{STATUS_LABEL[p.status]}</b></div>
        </div>
        <div style={{ lineHeight: 1.7 }}>
          {p.items.map((it, i) => <div key={i}>{it.item_name} · {formatLineSize(it.weight, it.weight_unit)} × {it.qty} <span style={{ float: 'right' }}>{inr(it.line_total)}</span></div>)}
        </div>
        <div style={{ borderTop: '0.5px solid #E5E5E0', paddingTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}><span>Total</span><span>{inr(p.total_amount)}</span></div>
          {preorderPayments(p).map((x, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', color: '#3B6D11' }}>
              <span>{KIND[x.kind]} · {MODE_LABEL[x.mode]} · {formatDay(x.at)}</span><span>{inr(x.amount)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: due ? '#B45309' : '#3B6D11' }}>
            <span>{due ? 'Balance' : 'Fully paid'}</span><span>{inr(due)}</span>
          </div>
        </div>
        {p.notes && <div style={{ color: '#5A5A55' }}>Note: {p.notes}</div>}
        <div className="pos-tools">
          {open && <button type="button" className="ui-btn primary" onClick={then(() => actions.startHandover(p))}>Hand over{due ? ` · collect ${inr(due)}` : ''}</button>}
          {!open && p.status === 'delivered' && due > 0 && <button type="button" className="ui-btn primary" onClick={then(() => actions.startCollect(p))}>Collect {inr(due)}</button>}
          {open && <button type="button" className="ui-btn" onClick={then(() => actions.togglePacked(p))}>{isPacked(p) ? 'Not packed yet' : 'Mark packed'}</button>}
          {open && <button type="button" className="ui-btn" onClick={then(onEdit)}>Edit</button>}
          <button type="button" className="ui-btn" onClick={onPrint}>Print slip</button>
          <MoreMenu items={[
            ...(p.phone ? [{ label: 'Send slip on WhatsApp', onClick: onShare }] : []),
            ...(p.phone && due > 0 ? [{ label: 'Remind about balance', onClick: () => actions.remind(p) }] : []),
            ...(open ? [{ label: 'Cancel booking…', onClick: then(() => actions.changeStatus(p, 'cancelled')), danger: true }] : []),
            { label: 'Delete booking', onClick: then(() => actions.remove(p)), danger: true },
          ]} />
        </div>
      </div>
    </Modal>
  );
};

export default PreorderDetail;
