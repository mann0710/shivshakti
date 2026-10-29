import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { SeasonalOrder, useUpdateSeasonalOrderPaid, useDeleteSeasonalOrder } from '../../hooks/useSeasonalOrders';
import { SeasonalOccasion } from '../../hooks/useSeasonalOccasions';
import { orderReceipt, printReceipt, shareReceipt, formatDay } from '../../lib/sessionalReceipts';
import { billNumber } from '../../lib/receipt';
import { formatLineSize } from '../../lib/units';
import { inr, cleanPhone } from '../../lib/money';
import { todayIST } from '../../lib/ist';
import Modal from '../ui/Modal';
import { useConfirm } from '../ui/ConfirmDialog';
import { card, btnSm, btnGhost, btnPrimary, inp, empty, pill, segBtn, segWrap, NAVY, DANGER, SUCCESS } from '../ui/styles';

interface Props {
  orders: SeasonalOrder[];
  occasions: SeasonalOccasion[];
  gst?: string;
  onEdit: (o: SeasonalOrder) => void;
}

type Show = 'all' | 'unpaid' | 'today';

const istDay = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

// Bills list with day summary (cash / UPI / unpaid), search and quick actions.
const OrdersTab: React.FC<Props> = ({ orders, occasions, gst, onEdit }) => {
  const markPaid = useUpdateSeasonalOrderPaid();
  const del = useDeleteSeasonalOrder();
  const { confirm, dialog } = useConfirm();
  const [show, setShow] = useState<Show>('today');
  const [q, setQ] = useState('');
  const [paying, setPaying] = useState<SeasonalOrder | null>(null);
  const occName = (id?: string) => occasions.find(o => o.id === id)?.name;
  const today = todayIST();

  const todays = useMemo(() => orders.filter(o => istDay(o.created_at) === today), [orders, today]);
  const sum = (list: SeasonalOrder[]) => list.reduce((s, o) => s + o.total_amount, 0);
  const day = {
    cash: sum(todays.filter(o => o.is_paid && o.payment_mode !== 'upi')),
    upi: sum(todays.filter(o => o.is_paid && o.payment_mode === 'upi')),
    unpaid: sum(todays.filter(o => !o.is_paid)),
  };

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    const digits = cleanPhone(q);
    return orders
      .filter(o => (show === 'unpaid' ? !o.is_paid : show === 'today' ? istDay(o.created_at) === today : true))
      .filter(o => !term || o.customer_name.toLowerCase().includes(term) || (digits.length >= 3 && (o.phone ?? '').includes(digits))
        || billNumber(o.bill_no, o.id).toLowerCase() === term.replace('#', ''));
  }, [orders, show, q, today]);

  const receipt = (o: SeasonalOrder) => orderReceipt(o, occName(o.occasion_id), gst);

  const remove = async (o: SeasonalOrder) => {
    const ok = await confirm({ title: 'Delete bill?', message: `Bill #${billNumber(o.bill_no, o.id)} of ${o.customer_name} (${inr(o.total_amount)}) will be removed permanently.`, confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try { await del.mutateAsync(o.id); toast.success('Bill deleted'); } catch (e: any) { toast.error(e.message); }
  };

  const pay = async (mode: 'cash' | 'upi') => {
    if (!paying) return;
    try { await markPaid.mutateAsync({ id: paying.id, is_paid: true, payment_mode: mode }); toast.success(`Marked paid by ${mode.toUpperCase()}`); setPaying(null); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div>
      <div className="g4" style={{ marginBottom: 14 }}>
        <Stat label="Today's sales" value={inr(sum(todays))} sub={`${todays.length} bills`} />
        <Stat label="Cash in drawer" value={inr(day.cash)} sub="Paid by cash today" color={SUCCESS} />
        <Stat label="UPI received" value={inr(day.upi)} sub="Paid by UPI today" color={NAVY} />
        <Stat label="Unpaid today" value={inr(day.unpaid)} sub="To collect" color={day.unpaid ? DANGER : SUCCESS} />
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ ...segWrap, minWidth: 240 }}>
          {(['today', 'unpaid', 'all'] as Show[]).map(s => (
            <button key={s} type="button" style={segBtn(show === s)} onClick={() => setShow(s)}>
              {s === 'today' ? 'Today' : s === 'unpaid' ? `Unpaid (${orders.filter(o => !o.is_paid).length})` : 'All year'}
            </button>
          ))}
        </div>
        <input style={{ ...inp, flex: '1 1 200px', width: 'auto' }} value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, mobile or bill #" />
      </div>

      {shown.length === 0 ? <div style={empty}>{q ? `No bills match "${q}".` : show === 'today' ? 'No bills yet today.' : 'No bills.'}</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {shown.map(o => (
            <div key={o.id} style={{ ...card, padding: 14, marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    <span style={{ color: '#888880', fontWeight: 500 }}>#{billNumber(o.bill_no, o.id)}</span> {o.customer_name}
                  </div>
                  <div style={{ fontSize: 11, color: '#888880' }}>{[o.phone, o.address, formatDay(o.created_at)].filter(Boolean).join(' · ')}</div>
                  {occName(o.occasion_id) && <span style={{ ...pill('#EEF0FB', NAVY), marginTop: 4 }}>{occName(o.occasion_id)}</span>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>{inr(o.total_amount)}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: o.is_paid ? SUCCESS : DANGER }}>
                    {o.is_paid ? `✓ Paid · ${(o.payment_mode ?? 'cash').toUpperCase()}` : '⏳ Unpaid'}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: '#555', lineHeight: 1.6 }}>
                {o.items.map((it, i) => <span key={i} style={{ marginRight: 10 }}>{it.item_name} ({formatLineSize(it.weight, it.weight_unit)}) ×{it.qty}</span>)}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                {!o.is_paid && <button style={{ ...btnSm, color: SUCCESS }} onClick={() => setPaying(o)}>Mark paid</button>}
                <button style={btnSm} onClick={() => printReceipt(receipt(o))}>🖨 Print</button>
                {o.phone && <button style={{ ...btnSm, color: '#128C7E' }} onClick={() => shareReceipt(receipt(o))}>WhatsApp</button>}
                <button style={btnSm} onClick={() => onEdit(o)}>Edit</button>
                <button style={{ ...btnSm, color: DANGER }} onClick={() => remove(o)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {paying && (
        <Modal title={`Collect ${inr(paying.total_amount)}`} onClose={() => setPaying(null)} width={360}
          footer={<button style={btnGhost} onClick={() => setPaying(null)}>Cancel</button>}>
          <div style={{ fontSize: 13, marginBottom: 12 }}>{paying.customer_name} paid by:</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ ...btnPrimary, flex: 1, height: 48 }} onClick={() => pay('cash')}>Cash</button>
            <button style={{ ...btnPrimary, flex: 1, height: 48 }} onClick={() => pay('upi')}>UPI</button>
          </div>
        </Modal>
      )}
      {dialog}
    </div>
  );
};

export const Stat: React.FC<{ label: string; value: string; sub: string; color?: string }> = ({ label, value, sub, color }) => (
  <div style={{ background: '#fff', border: '0.5px solid #E5E5E0', borderRadius: 10, padding: '12px 14px' }}>
    <div style={{ fontSize: 11, color: '#888880', marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 18, fontWeight: 700 }}>{value}</div>
    <div style={{ fontSize: 11, color: color ?? '#AAAAAA', marginTop: 2 }}>{sub}</div>
  </div>
);

export default OrdersTab;
