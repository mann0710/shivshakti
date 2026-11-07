import React, { useMemo } from 'react';
import BillCard from './BillCard';
import BillFilters from './BillFilters';
import { MenuItem } from '../pos/MoreMenu';
import { useBillActions } from '../pos/useBillActions';
import { SeasonalOrder } from '../../hooks/useSeasonalOrders';
import { SeasonalPreorder } from '../../hooks/useSeasonalPreorders';
import { SeasonalOccasion } from '../../hooks/useSeasonalOccasions';
import { usePreorderActions } from '../../hooks/usePreorderActions';
import { orderReceipt, preorderReceipt, printReceipt, shareReceipt, receiptDoc } from '../../lib/sessionalReceipts';
import { sweetsInvoiceDoc } from '../../lib/docs/sweetsInvoice';
import { downloadDoc, printDoc } from '../../lib/docs/output';
import { BillRow, BillFilter, NO_FILTER, billRows, filterBills, billTotals, stageCounts, freshFilter, isOverdue } from '../../lib/billList';
import { useStoredState } from '../../hooks/useStoredState';
import { billDue, bookingDue } from '../../lib/dues';
import { summarize, dayStart } from '../../lib/dayClose';
import { istDay } from '../../lib/preorders';
import { inr } from '../../lib/money';
import { todayIST } from '../../lib/ist';
import { empty, NAVY, NAVY_SOFT, DANGER, SUCCESS } from '../ui/styles';

interface Props {
  orders: SeasonalOrder[];
  preorders: SeasonalPreorder[];
  occasions: SeasonalOccasion[];
  gst?: string;
  onEdit: (o: SeasonalOrder) => void;
  search?: string;
}

const FILTER_KEY = 'shivshakti.billFilters';

// Today's money, then every sale (counter bills and pre-bookings) with filters, totals and an A4 invoice each.
const OrdersTab: React.FC<Props> = ({ orders, preorders, occasions, gst, onEdit, search }) => {
  const bills = useBillActions();
  const bookings = usePreorderActions();
  const today = todayIST();
  // Remembered on this device; opened for one customer, it shows all their sales without saving that.
  const [kept, setF] = useStoredState<BillFilter>(search ? null : FILTER_KEY, () => (search ? { ...NO_FILTER, stage: 'all', q: search } : NO_FILTER));
  const f = useMemo(() => freshFilter(kept, today), [kept, today]);
  const occName = (id?: string) => occasions.find(o => o.id === id)?.name;

  const day = useMemo(() => summarize(orders, preorders, dayStart(today), new Date().toISOString()), [orders, preorders, today]);
  const todays = useMemo(() => orders.filter(o => istDay(o.created_at) === today && !o.cancelled_at), [orders, today]);
  const rows = useMemo(() => billRows(orders, preorders), [orders, preorders]);
  const shown = useMemo(() => filterBills(rows, f), [rows, f]);
  const counts = useMemo(() => stageCounts(filterBills(rows, f, true)), [rows, f]);
  const sum = billTotals(shown);
  const dueTotal = orders.reduce((s, o) => s + billDue(o), 0) + preorders.reduce((s, p) => s + bookingDue(p), 0);
  const dueCount = orders.filter(o => billDue(o) > 0).length + preorders.filter(p => bookingDue(p) > 0).length;
  const unpaidRows = useMemo(() => rows.filter(r => r.due > 0).length, [rows]);

  const invoice = (r: BillRow) => () => sweetsInvoiceDoc(r, occName(r.occasion_id));
  const slip = (r: BillRow) => (r.order ? orderReceipt(r.order, occName(r.occasion_id), gst) : preorderReceipt(r.booking!, occName(r.occasion_id), gst));
  const menuFor = (r: BillRow): MenuItem[] => {
    const o = r.order;
    const slipMenu = [
      { label: o ? 'Print 80 mm receipt' : 'Print pre-booking slip', onClick: () => printReceipt(slip(r)) },
      { label: o ? '80 mm receipt PDF' : 'Pre-booking slip PDF', onClick: () => downloadDoc(() => receiptDoc(slip(r))) },
    ];
    if (!o) return [...slipMenu, ...bookings.menuFor(r.booking!)];
    return [...slipMenu, ...(!o.cancelled_at ? [{ label: 'Take back items', onClick: () => onEdit(o) }] : []), ...bills.menuFor(o)];
  };
  // Counter bills collect any due; pre-bookings only once handed over (before that, at pickup).
  const owes = (r: BillRow) => (r.order ? billDue(r.order) : bookingDue(r.booking!)) > 0;
  const collect = (r: BillRow) => (r.order ? bills.startCollect(r.order) : bookings.startCollect(r.booking!));
  const remind = (r: BillRow) => (r.order ? bills.remind(r.order) : bookings.remind(r.booking!));

  return (
    <div>
      <div className="g4" style={{ marginBottom: 14 }}>
        <Stat label="Sold today" value={inr(todays.reduce((s, o) => s + o.total_amount, 0))} sub={`${todays.length} bill${todays.length === 1 ? '' : 's'}`} />
        <Stat label="Cash today" value={inr(day.cash)} sub="Bills, advances and dues" color={SUCCESS} />
        <Stat label="UPI today" value={inr(day.upi_total)} sub={`${day.upi_count} payment${day.upi_count === 1 ? '' : 's'}`} color={NAVY} />
        <Stat label="Unpaid" value={inr(dueTotal)} sub={dueCount ? `${dueCount} to collect` : 'Nothing due'} color={dueCount ? DANGER : SUCCESS} />
      </div>

      <BillFilters value={f} onChange={setF} occasions={occasions} counts={counts} unpaid={unpaidRows} />
      <div className="bill-totals" role="status" aria-label="Totals for the sales shown">
        <div>Sales shown<b>{sum.count}</b>{sum.cancelled ? `${sum.cancelled} cancelled` : ''}</div>
        <div style={{ '--bg': NAVY_SOFT, '--c': NAVY } as React.CSSProperties}>Billed<b>{inr(sum.billed)}</b></div>
        <div style={{ '--bg': '#EAF3DE', '--c': SUCCESS } as React.CSSProperties}>Received<b>{inr(sum.received)}</b></div>
        <div style={sum.due ? { '--bg': '#FEECEC', '--c': DANGER } as React.CSSProperties : undefined}>Due<b>{inr(sum.due)}</b></div>
      </div>

      {shown.length === 0 ? (
        <div style={empty}>{rows.length ? 'No sales match these filters.' : 'No bills or pre-bookings this year.'}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {shown.map(r => (
            <BillCard key={r.id} row={r} occasion={occName(r.occasion_id)} overdue={isOverdue(r, today)} menu={menuFor(r)}
              onCollect={owes(r) ? () => collect(r) : undefined} onRemind={owes(r) && r.phone ? () => remind(r) : undefined}
              onPrint={() => printDoc(invoice(r))} onPdf={() => downloadDoc(invoice(r))}
              onShare={r.phone && !r.cancelled ? () => shareReceipt(slip(r)) : undefined} />
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
