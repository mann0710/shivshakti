import React, { useMemo, useState } from 'react';
import BillCard from './BillCard';
import { MenuItem } from '../pos/MoreMenu';
import { useBillActions } from '../pos/useBillActions';
import { SeasonalOrder } from '../../hooks/useSeasonalOrders';
import { SeasonalPreorder } from '../../hooks/useSeasonalPreorders';
import { SeasonalOccasion } from '../../hooks/useSeasonalOccasions';
import { usePreorderActions } from '../../hooks/usePreorderActions';
import { orderReceipt, printReceipt, shareReceipt, formatDay } from '../../lib/sessionalReceipts';
import { billNumber } from '../../lib/receipt';
import { billDue, bookingDue, isTestBill } from '../../lib/dues';
import { summarize, dayStart } from '../../lib/dayClose';
import { istDay } from '../../lib/preorders';
import { inr, cleanPhone } from '../../lib/money';
import { todayIST } from '../../lib/ist';
import { card, inp, empty, segBtn, segWrap, NAVY, DANGER, SUCCESS } from '../ui/styles';

interface Props {
  orders: SeasonalOrder[];
  preorders: SeasonalPreorder[];
  occasions: SeasonalOccasion[];
  gst?: string;
  onEdit: (o: SeasonalOrder) => void;
}

type Show = 'today' | 'unpaid' | 'all';

const matches = (term: string, name: string, phone?: string, no?: string) => {
  const t = term.trim().toLowerCase();
  const digits = cleanPhone(term);
  return !t || name.toLowerCase().includes(t) || (digits.length >= 3 && (phone ?? '').includes(digits)) || (!!no && no.toLowerCase() === t.replace('#', ''));
};

// Today's money, then bills (and handed-over bookings still owing) with collect, remind and ⋯ More.
const OrdersTab: React.FC<Props> = ({ orders, preorders, occasions, gst, onEdit }) => {
  const bills = useBillActions();
  const bookings = usePreorderActions();
  const [show, setShow] = useState<Show>('today');
  const [q, setQ] = useState('');
  const occName = (id?: string) => occasions.find(o => o.id === id)?.name;
  const today = todayIST();

  const day = useMemo(() => summarize(orders, preorders, dayStart(today), new Date().toISOString()), [orders, preorders, today]);
  const todays = useMemo(() => orders.filter(o => istDay(o.created_at) === today && !o.cancelled_at), [orders, today]);
  const owing = useMemo(() => ({
    bills: orders.filter(o => billDue(o) > 0),
    bookings: preorders.filter(p => bookingDue(p) > 0),
  }), [orders, preorders]);
  const dueTotal = owing.bills.reduce((s, o) => s + billDue(o), 0) + owing.bookings.reduce((s, p) => s + bookingDue(p), 0);
  const dueCount = owing.bills.length + owing.bookings.length;

  const shown = useMemo(() => (show === 'unpaid' ? owing.bills : show === 'today' ? orders.filter(o => istDay(o.created_at) === today) : orders)
    .filter(o => matches(q, o.customer_name, o.phone, billNumber(o.bill_no, o.id))), [orders, owing, show, q, today]);
  const shownBookings = show === 'unpaid' ? owing.bookings.filter(p => matches(q, p.customer_name, p.phone)) : [];

  const receipt = (o: SeasonalOrder) => orderReceipt(o, occName(o.occasion_id), gst);
  const menuFor = (o: SeasonalOrder): MenuItem[] => [
    ...(!o.cancelled_at ? [{ label: 'Take back items', onClick: () => onEdit(o) }] : []),
    ...(!o.cancelled_at && bills.canCancel ? [{ label: 'Cancel bill…', onClick: () => bills.startCancel(o), danger: true }] : []),
    ...(isTestBill(o) ? [{ label: 'Delete test bill', onClick: () => bills.removeTest(o), danger: true }] : []),
  ];

  return (
    <div>
      <div className="g4" style={{ marginBottom: 14 }}>
        <Stat label="Sold today" value={inr(todays.reduce((s, o) => s + o.total_amount, 0))} sub={`${todays.length} bill${todays.length === 1 ? '' : 's'}`} />
        <Stat label="Cash today" value={inr(day.cash)} sub="Bills, advances and dues" color={SUCCESS} />
        <Stat label="UPI today" value={inr(day.upi_total)} sub={`${day.upi_count} payment${day.upi_count === 1 ? '' : 's'}`} color={NAVY} />
        <Stat label="Unpaid" value={inr(dueTotal)} sub={dueCount ? `${dueCount} to collect` : 'Nothing due'} color={dueCount ? DANGER : SUCCESS} />
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ ...segWrap, minWidth: 260 }}>
          {(['today', 'unpaid', 'all'] as Show[]).map(s => (
            <button key={s} type="button" style={{ ...segBtn(show === s), minHeight: 44 }} aria-pressed={show === s} onClick={() => setShow(s)}>
              {s === 'today' ? 'Today' : s === 'unpaid' ? `Unpaid (${dueCount})` : 'All year'}
            </button>
          ))}
        </div>
        <input style={{ ...inp, flex: '1 1 200px', width: 'auto', minHeight: 44 }} value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, mobile or bill #" />
      </div>

      {shown.length + shownBookings.length === 0 ? (
        <div style={empty}>{q ? `No bills match "${q}".` : show === 'today' ? 'No bills yet today.' : show === 'unpaid' ? 'Nothing to collect.' : 'No bills.'}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {shownBookings.map(p => (
            <div key={p.id} style={{ ...card, padding: 14, marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{p.customer_name}</div>
                  <div style={{ fontSize: 12, color: '#5A5A55' }}>{[p.phone, `Pre-booking handed over ${formatDay(p.delivered_at ?? p.delivery_date ?? p.created_at)}`].filter(Boolean).join(' · ')}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: NAVY }}>{inr(p.total_amount)}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: DANGER }}>Paid {inr(p.advance_paid)} · {inr(bookingDue(p))} due</div>
                </div>
              </div>
              <div className="pos-tools" style={{ marginTop: 10 }}>
                <button type="button" className="ui-btn primary" onClick={() => bookings.startCollect(p)}>Collect {inr(bookingDue(p))}</button>
                {p.phone && <button type="button" className="ui-btn" onClick={() => bookings.remind(p)}>Remind</button>}
              </div>
            </div>
          ))}
          {shown.map(o => (
            <BillCard key={o.id} order={o} occasion={occName(o.occasion_id)} menu={menuFor(o)}
              onCollect={() => bills.startCollect(o)} onRemind={() => bills.remind(o)}
              onPrint={() => printReceipt(receipt(o))} onShare={() => shareReceipt(receipt(o))} />
          ))}
        </div>
      )}

      {bills.ui}
      {bookings.ui}
    </div>
  );
};

export const Stat: React.FC<{ label: string; value: string; sub: string; color?: string }> = ({ label, value, sub, color }) => (
  <div style={{ background: '#fff', border: '0.5px solid #E5E5E0', borderRadius: 10, padding: '12px 14px' }}>
    <div style={{ fontSize: 12, color: '#5A5A55', marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 18, fontWeight: 700 }}>{value}</div>
    <div style={{ fontSize: 12, color: color ?? '#5A5A55', marginTop: 2 }}>{sub}</div>
  </div>
);

export default OrdersTab;
