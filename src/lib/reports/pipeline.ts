import { totalsByItem } from '../cart';
import { nameKey } from '../itemCatalog';
import { formatSize } from '../units';
import { balanceOf, fulfillmentOf, isOpenPreorder, istDay, FULFILLMENT_LABEL, STATUS_LABEL, PreStatus } from '../preorders';
import { Report, sumBy, share, groupBy, inRange, showDay } from './model';
import { ReportInput, preordersOf, occasionNote } from './input';

const STATUS_ORDER: PreStatus[] = ['pending', 'confirmed', 'ready', 'delivered', 'cancelled'];
const BOOKING_STATUS = ['inquiry', 'followup', 'pending', 'confirmed', 'completed', 'cancelled'];

// Pre-bookings due in the period (or booked in it when no date was set).
export function preorderReport(inp: ReportInput): Report {
  const list = preordersOf(inp).filter(p => (p.delivery_date ? inRange(p.delivery_date, inp.range) : inRange(istDay(p.created_at), inp.range)))
    .sort((a, b) => (a.delivery_date || '9').localeCompare(b.delivery_date || '9') || a.customer_name.localeCompare(b.customer_name));
  const live = list.filter(p => p.status !== 'cancelled');
  const open = list.filter(isOpenPreorder);
  const value = sumBy(live, p => p.total_amount);
  const make = totalsByItem(open.flatMap(p => p.items), l => nameKey(l.item_name));

  const byStatus = STATUS_ORDER.map(s => {
    const l = list.filter(p => p.status === s);
    return { status: STATUS_LABEL[s], n: l.length, value: sumBy(l, p => p.total_amount), paid: sumBy(l, p => p.advance_paid), bal: s === 'cancelled' ? 0 : sumBy(l, balanceOf) };
  }).filter(r => r.n);
  const byDay = Array.from(groupBy(live, p => p.delivery_date || ''), ([d, l]) => ({
    day: d ? showDay(d) : 'No date', n: l.length, pickup: l.filter(p => fulfillmentOf(p) === 'pickup').length,
    delivery: l.filter(p => fulfillmentOf(p) === 'delivery').length, value: sumBy(l, p => p.total_amount), bal: sumBy(l, balanceOf),
  }));

  return {
    title: 'Pre-booking pipeline',
    note: `Pre-bookings due in the period${occasionNote(inp)}`,
    stats: [
      { label: 'Booked value', value, fmt: 'money', sub: `${live.length} bookings` },
      { label: 'Advance received', value: sumBy(live, p => p.advance_paid), fmt: 'money', sub: `${share(sumBy(live, p => p.advance_paid), value)}% of value` },
      { label: 'Balance to collect', value: sumBy(live, balanceOf), fmt: 'money', tone: sumBy(live, balanceOf) ? 'warn' : 'good' },
      { label: 'Still open', value: open.length, fmt: 'int', sub: `${list.filter(p => p.status === 'delivered').length} handed over · ${list.length - live.length} cancelled` },
    ],
    tables: [
      { title: 'By status', cols: [{ key: 'status', label: 'Status' }, { key: 'n', label: 'Bookings', fmt: 'int' }, { key: 'value', label: 'Value', fmt: 'money' }, { key: 'paid', label: 'Paid', fmt: 'money' }, { key: 'bal', label: 'Balance', fmt: 'money' }],
        rows: byStatus, total: { status: 'Total', n: list.length, value: sumBy(list, p => p.total_amount), paid: sumBy(list, p => p.advance_paid), bal: sumBy(live, balanceOf) }, empty: 'No pre-bookings due in this period.' },
      { title: 'By hand-over date', cols: [{ key: 'day', label: 'Date' }, { key: 'n', label: 'Bookings', fmt: 'int' }, { key: 'pickup', label: 'Pickup', fmt: 'int' }, { key: 'delivery', label: 'Delivery', fmt: 'int' }, { key: 'value', label: 'Value', fmt: 'money' }, { key: 'bal', label: 'Balance', fmt: 'money' }],
        rows: byDay, empty: 'No pre-bookings due in this period.' },
      { title: 'Still to make (open bookings)', cols: [{ key: 'name', label: 'Item' }, { key: 'qty', label: 'Quantity' }, { key: 'packs', label: 'Packs', fmt: 'int' }],
        rows: make.map(t => ({ name: t.name, qty: formatSize(t.amount, t.unit), packs: t.packs })), empty: 'Nothing left to make.' },
      { title: 'All bookings', cols: [{ key: 'due', label: 'Due' }, { key: 'name', label: 'Customer' }, { key: 'phone', label: 'Mobile' }, { key: 'type', label: 'Type' }, { key: 'status', label: 'Status' }, { key: 'total', label: 'Total', fmt: 'money' }, { key: 'paid', label: 'Paid', fmt: 'money' }, { key: 'bal', label: 'Balance', fmt: 'money' }],
        rows: list.map(p => ({ due: p.delivery_date ? showDay(p.delivery_date) : '—', name: p.customer_name, phone: p.phone, type: FULFILLMENT_LABEL[fulfillmentOf(p)], status: STATUS_LABEL[p.status], total: p.total_amount, paid: p.advance_paid, bal: p.status === 'cancelled' ? 0 : balanceOf(p) })),
        empty: 'No pre-bookings due in this period.' },
    ],
  };
}

// Catering events held in the period, what they are worth and what has been collected.
export function cateringReport(inp: ReportInput): Report {
  const events = inp.bookings.filter(b => inRange(b.event_date, inp.range)).sort((a, b) => a.event_date.localeCompare(b.event_date));
  const live = events.filter(b => b.status !== 'cancelled');
  const invOf = (id: string) => inp.invoices.filter(i => i.booking_id === id);
  const value = sumBy(live, inp.bookingValue);
  const invoiced = sumBy(live, b => sumBy(invOf(b.id), i => i.total_amount));
  const balance = sumBy(live, b => sumBy(invOf(b.id), i => i.balance_due));
  const collected = sumBy(inp.payments.filter(p => inRange(p.payment_date, inp.range)), p => p.amount);
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  return {
    title: 'Catering bookings & revenue',
    note: 'Events dated in the period; payments are those received in the period (any event)',
    stats: [
      { label: 'Booked value', value, fmt: 'money', sub: `${live.length} events · ${sumBy(live, b => b.guest_count).toLocaleString('en-IN')} guests` },
      { label: 'Invoiced', value: invoiced, fmt: 'money', sub: `${live.filter(b => invOf(b.id).length).length} invoices` },
      { label: 'Collected in period', value: collected, fmt: 'money', tone: 'good' },
      { label: 'Balance on these events', value: balance, fmt: 'money', tone: balance ? 'warn' : 'good' },
    ],
    tables: [
      { title: 'Events', cols: [{ key: 'day', label: 'Date' }, { key: 'name', label: 'Customer' }, { key: 'type', label: 'Event' }, { key: 'guests', label: 'Guests', fmt: 'int' }, { key: 'status', label: 'Status' }, { key: 'value', label: 'Value', fmt: 'money' }, { key: 'paid', label: 'Paid', fmt: 'money' }, { key: 'bal', label: 'Balance', fmt: 'money' }],
        rows: events.map(b => ({ day: showDay(b.event_date), name: b.customer?.name, type: b.event_type, guests: b.guest_count, status: cap(b.status), value: b.status === 'cancelled' ? 0 : inp.bookingValue(b), paid: sumBy(invOf(b.id), i => i.advance_paid), bal: sumBy(invOf(b.id), i => i.balance_due) })),
        total: { day: 'Total', guests: sumBy(live, b => b.guest_count), value, paid: sumBy(live, b => sumBy(invOf(b.id), i => i.advance_paid)), bal: balance }, empty: 'No catering events in this period.' },
      { title: 'By event type', cols: [{ key: 'type', label: 'Event' }, { key: 'n', label: 'Events', fmt: 'int' }, { key: 'guests', label: 'Guests', fmt: 'int' }, { key: 'value', label: 'Value', fmt: 'money' }, { key: 'share', label: 'Share', fmt: 'pct' }],
        rows: Array.from(groupBy(live, b => b.event_type || 'Other'), ([type, l]) => ({ type, n: l.length, guests: sumBy(l, b => b.guest_count), value: sumBy(l, inp.bookingValue) }))
          .sort((a, b) => b.value - a.value).map(r => ({ ...r, share: share(r.value, value) })), empty: 'No catering events in this period.' },
      { title: 'By status', cols: [{ key: 'status', label: 'Status' }, { key: 'n', label: 'Events', fmt: 'int' }, { key: 'value', label: 'Value', fmt: 'money' }],
        rows: BOOKING_STATUS.map(s => ({ status: cap(s), l: events.filter(b => b.status === s) })).filter(r => r.l.length)
          .map(r => ({ status: r.status, n: r.l.length, value: r.status === 'Cancelled' ? 0 : sumBy(r.l, inp.bookingValue) })), empty: 'No catering events in this period.' },
    ],
  };
}
