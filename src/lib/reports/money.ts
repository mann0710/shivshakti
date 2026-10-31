import { billNumber } from '../receipt';
import { balanceOf, istDay, modeLabel, STATUS_LABEL } from '../preorders';
import { moneyIn } from '../payments';
import { billDue } from '../dues';
import { Report, Row, sumBy, share, groupBy, inRange, bucketOf, showDay } from './model';
import { ReportInput, billsIn, ordersOf, preordersOf, unpaidOf, occasionNote } from './input';

type Source = 'bills' | 'advance' | 'handover' | 'catering';
interface Receipt { day: string; source: Source; mode: string; amount: number }

const MODE_ORDER = ['Cash', 'UPI', 'Bank transfer', 'Cheque', 'Not recorded'];

// Every rupee received in the period, on the day it came in, tagged by source and mode (refunds net off).
export function receiptsIn(inp: ReportInput): Receipt[] {
  const r = inp.range;
  const bookings = preordersOf(inp).filter(p => p.status !== 'cancelled');
  return [
    ...moneyIn(ordersOf(inp), bookings).filter(p => inRange(istDay(p.at), r)).map(p => ({
      day: istDay(p.at), mode: modeLabel(p.mode), amount: p.amount,
      source: p.source === 'bill' ? 'bills' as const : p.kind === 'advance' ? 'advance' as const : 'handover' as const,
    })),
    ...inp.payments.filter(p => inRange(p.payment_date, r))
      .map(p => ({ day: p.payment_date, source: 'catering' as const, mode: modeLabel(p.payment_mode), amount: Number(p.amount) || 0 })),
  ];
}

export function paymentsReport(inp: ReportInput): Report {
  const all = receiptsIn(inp);
  const total = sumBy(all, x => x.amount);
  const of = (list: Receipt[], s: Source) => sumBy(list.filter(x => x.source === s), x => x.amount);
  const byMode = Array.from(groupBy(all, x => x.mode), ([mode, list]) => ({
    mode, bills: of(list, 'bills'), advance: of(list, 'advance'), handover: of(list, 'handover'), catering: of(list, 'catering'), total: sumBy(list, x => x.amount),
  })).sort((a, b) => MODE_ORDER.indexOf(a.mode) - MODE_ORDER.indexOf(b.mode)).map(m => ({ ...m, share: share(m.total, total) }));
  const mode = (m: string) => byMode.find(x => x.mode === m)?.total ?? 0;

  const b = bucketOf(inp.range);
  const days = Array.from(groupBy(all, x => b.key(x.day)), ([k, list]) => {
    const cash = sumBy(list.filter(x => x.mode === 'Cash'), x => x.amount);
    const upi = sumBy(list.filter(x => x.mode === 'UPI'), x => x.amount);
    const sum = sumBy(list, x => x.amount);
    return { k, day: b.show(k), cash, upi, other: sumBy([sum - cash - upi], x => x), total: sum };
  }).sort((x, y) => x.k.localeCompare(y.k));

  const unpaid = billsIn(inp).filter(o => billDue(o) > 0);
  return {
    title: 'Payments received',
    note: `Counter bills (by when paid), pre-booking advances, balances collected and catering payments${occasionNote(inp)}`,
    stats: [
      { label: 'Total received', value: total, fmt: 'money', sub: `${all.length} payments` },
      { label: 'Cash', value: mode('Cash'), fmt: 'money', sub: `${share(mode('Cash'), total)}%` },
      { label: 'UPI', value: mode('UPI'), fmt: 'money', sub: `${share(mode('UPI'), total)}%` },
      { label: 'Bills not paid yet', value: sumBy(unpaid, billDue), fmt: 'money', sub: `${unpaid.length} bills this period`, tone: unpaid.length ? 'bad' : 'good' },
    ],
    tables: [
      {
        title: 'By payment mode',
        cols: [{ key: 'mode', label: 'Mode' }, { key: 'bills', label: 'Counter bills', fmt: 'money' }, { key: 'advance', label: 'Pre-booking advance', fmt: 'money' },
          { key: 'handover', label: 'Booking balance', fmt: 'money' }, { key: 'catering', label: 'Catering', fmt: 'money' }, { key: 'total', label: 'Total', fmt: 'money' }, { key: 'share', label: 'Share', fmt: 'pct' }],
        rows: byMode,
        total: { mode: 'Total', bills: of(all, 'bills'), advance: of(all, 'advance'), handover: of(all, 'handover'), catering: of(all, 'catering'), total, share: total ? 100 : 0 },
        empty: 'No payments received in this period.',
      },
      {
        title: b.label === 'Date' ? 'Day by day' : 'Month by month',
        cols: [{ key: 'day', label: b.label }, { key: 'cash', label: 'Cash', fmt: 'money' }, { key: 'upi', label: 'UPI', fmt: 'money' }, { key: 'other', label: 'Other', fmt: 'money' }, { key: 'total', label: 'Total', fmt: 'money' }],
        rows: days,
        total: { day: 'Total', cash: mode('Cash'), upi: mode('UPI'), other: sumBy([total - mode('Cash') - mode('UPI')], x => x), total },
        empty: 'No payments received in this period.',
      },
    ],
  };
}

// Money still to come in, as of today (not limited to the date range).
export function duesReport(inp: ReportInput): Report {
  const bills = unpaidOf(inp).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const pre = preordersOf(inp).filter(p => p.status !== 'cancelled' && balanceOf(p) > 0)
    .sort((a, b) => (a.delivery_date || '9').localeCompare(b.delivery_date || '9'));
  const inv = inp.invoices.filter(i => Number(i.balance_due) > 0)
    .sort((a, b) => (a.booking?.event_date ?? '').localeCompare(b.booking?.event_date ?? ''));
  const billsDue = sumBy(bills, billDue);
  const preDue = sumBy(pre, balanceOf);
  const invDue = sumBy(inv, i => i.balance_due);
  const days = (d: string) => Math.max(0, Math.round((Date.parse(inp.today) - Date.parse(d)) / 86400000));

  return {
    title: 'Outstanding dues',
    note: `As of ${showDay(inp.today)} — all dates, not limited to the selected period${occasionNote(inp)}`,
    stats: [
      { label: 'Total outstanding', value: billsDue + preDue + invDue, fmt: 'money', tone: billsDue + preDue + invDue ? 'bad' : 'good' },
      { label: 'Unpaid sweets bills', value: billsDue, fmt: 'money', sub: `${bills.length} bills` },
      { label: 'Pre-booking balances', value: preDue, fmt: 'money', sub: `${pre.length} bookings` },
      { label: 'Catering balances', value: invDue, fmt: 'money', sub: `${inv.length} invoices` },
    ],
    tables: [
      {
        title: 'Unpaid sweets bills',
        cols: [{ key: 'no', label: 'Bill' }, { key: 'day', label: 'Date' }, { key: 'age', label: 'Days', fmt: 'int' }, { key: 'name', label: 'Customer' }, { key: 'phone', label: 'Mobile' }, { key: 'amount', label: 'Bill', fmt: 'money' }, { key: 'due', label: 'Due', fmt: 'money' }],
        rows: bills.map(o => ({ no: billNumber(o.bill_no, o.id), day: showDay(istDay(o.created_at)), age: days(istDay(o.created_at)), name: o.customer_name, phone: o.phone, amount: o.total_amount, due: billDue(o) })),
        total: { no: 'Total', amount: sumBy(bills, o => o.total_amount), due: billsDue }, empty: 'All sweets bills are paid.',
      },
      {
        title: 'Pre-booking balances',
        cols: [{ key: 'due', label: 'Due' }, { key: 'name', label: 'Customer' }, { key: 'phone', label: 'Mobile' }, { key: 'status', label: 'Status' },
          { key: 'total', label: 'Total', fmt: 'money' }, { key: 'paid', label: 'Paid', fmt: 'money' }, { key: 'bal', label: 'Balance', fmt: 'money' }],
        rows: pre.map(p => ({ due: p.delivery_date ? showDay(p.delivery_date) : '—', name: p.customer_name, phone: p.phone, status: STATUS_LABEL[p.status], total: p.total_amount, paid: p.advance_paid, bal: balanceOf(p) })),
        total: { due: 'Total', total: sumBy(pre, p => p.total_amount), paid: sumBy(pre, p => p.advance_paid), bal: preDue }, empty: 'No pre-booking balances.',
      },
      {
        title: 'Catering invoices',
        cols: [{ key: 'no', label: 'Invoice' }, { key: 'day', label: 'Event' }, { key: 'name', label: 'Customer' }, { key: 'phone', label: 'Mobile' },
          { key: 'total', label: 'Total', fmt: 'money' }, { key: 'paid', label: 'Paid', fmt: 'money' }, { key: 'bal', label: 'Balance', fmt: 'money' }],
        rows: inv.map((i): Row => ({ no: i.invoice_number, day: i.booking?.event_date ? showDay(i.booking.event_date) : '—', name: i.booking?.customer?.name, phone: i.booking?.customer?.phone, total: i.total_amount, paid: i.advance_paid, bal: i.balance_due })),
        total: { no: 'Total', total: sumBy(inv, i => i.total_amount), paid: sumBy(inv, i => i.advance_paid), bal: invDue }, empty: 'No catering balances.',
      },
    ],
  };
}
