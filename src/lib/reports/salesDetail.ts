import { inr } from '../money';
import { formatSize } from '../units';
import { formatPhone } from '../people';
import { Report, Row, sumBy, groupBy, bucketOf, showDay, rangeLabel } from './model';
import { ReportInput, occasionNote, leftOut, cancelledBillsIn } from './input';
import { Sale, salesOf, itemTotals, qtyOf, customerKey, totalsOf, Totals, previousRange, lastYearRange, change } from './sales';

// Detailed sales: summary with comparisons, the bill register and per-customer sales.

const note = (inp: ReportInput) => `Counter bills + pre-bookings handed over${occasionNote(inp)}`;
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
const itemsText = (s: Sale) => Array.from(new Set(s.lines.map(l => l.item_name))).slice(0, 3).join(', ');

// [label, value, how to show it]; text rows are shown but not compared.
type Metric = [label: string, pick: (t: Totals) => number, show: 'money' | 'int' | ((t: Totals) => string)];
const METRICS: Metric[] = [
  ['Gross sales (before discounts)', t => t.gross, 'money'], ['Discounts', t => t.discount, 'money'], ['Net sales', t => t.net, 'money'],
  ['Sales (bills + pre-bookings)', t => t.sales, 'int'], ['Average bill', t => t.avg, 'money'], ['Items a bill', t => t.items, 'int'],
  ['Quantity sold', () => 0, t => t.qty || '—'],
  ['Handed back (take-backs)', t => t.refunds, 'money'], ['Cash at the sale', t => t.cash, 'money'], ['UPI at the sale', t => t.upi, 'money'],
  ['Left on credit', t => t.credit, 'money'],
];
const asText = ([, pick, show]: Metric, t: Totals) => (typeof show === 'function' ? show(t) : show === 'int' ? String(pick(t)) : inr(pick(t)));

export function summaryReport(inp: ReportInput): Report {
  const now = totalsOf(salesOf(inp, inp.range));
  const prevR = previousRange(inp.range);
  const lastR = lastYearRange(inp.range);
  const prev = inp.compare && totalsOf(salesOf({ ...inp, orders: inp.compare.previous }, prevR));
  const last = inp.compare && totalsOf(salesOf({ ...inp, orders: inp.compare.lastYear }, lastR));
  const vs = (n: number, t?: Totals, pick?: (t: Totals) => number) => (t && pick ? change(n, pick(t)) : '');
  return {
    title: 'Sales summary',
    note: `${note(inp)}${leftOut(cancelledBillsIn(inp))}${prev ? ` · compared with ${rangeLabel(prevR)} and ${rangeLabel(lastR)}` : ''}`,
    stats: [
      { label: 'Net sales', value: now.net, fmt: 'money', sub: prev ? `${vs(now.net, prev, t => t.net) || 'no sales'} vs previous period` : undefined, tone: prev && now.net < prev.net ? 'bad' : 'good' },
      { label: 'Sales', value: now.sales, fmt: 'int', sub: `avg bill ${inr(now.avg)}${prev ? ` · ${vs(now.avg, prev, t => t.avg) || '—'}` : ''}` },
      { label: 'Sold', value: now.qty || '—', sub: `${now.items} items a bill` },
      { label: 'At the sale', value: now.cash + now.upi, fmt: 'money', sub: `Cash ${inr(now.cash)} · UPI ${inr(now.upi)} · credit ${inr(now.credit)}` },
    ],
    tables: [{
      title: 'This period and compared',
      cols: [{ key: 'm', label: '' }, { key: 'now', label: 'This period' }, { key: 'prev', label: 'Previous period' }, { key: 'pc', label: 'Change' }, { key: 'last', label: 'Same dates last year' }, { key: 'lc', label: 'Change' }],
      rows: METRICS.map(m => ({
        m: m[0], now: asText(m, now),
        prev: prev ? asText(m, prev) : '', pc: prev && typeof m[2] !== 'function' ? change(m[1](now), m[1](prev)) : '',
        last: last ? asText(m, last) : '', lc: last && typeof m[2] !== 'function' ? change(m[1](now), m[1](last)) : '',
      })),
      empty: 'No sales in this period.',
    }],
  };
}

export function registerReport(inp: ReportInput): Report {
  const ok = salesOf(inp, inp.range);
  const row = (s: Sale): Row => ({
    day: showDay(s.day), dueDay: s.dueDay ? showDay(s.dueDay) : '', time: s.kind === 'bill' ? time(s.at) : '', no: s.no, name: s.name, items: itemsText(s), qty: qtyOf(itemTotals([s])),
    discount: s.discount || null, total: s.total, paid: s.paid, due: s.due || null, mode: s.mode,
    status: s.kind === 'booking' ? 'Pre-booking given' : 'Given',
  });
  return {
    title: 'Bill register',
    note: `Every sale in the period, newest first. ${note(inp)}${leftOut(cancelledBillsIn(inp))}`,
    stats: [
      { label: 'Sales', value: ok.length, fmt: 'int', sub: `${ok.filter(s => s.kind === 'bill').length} bills · ${ok.filter(s => s.kind === 'booking').length} pre-bookings` },
      { label: 'Total', value: sumBy(ok, s => s.total), fmt: 'money' },
      { label: 'Paid', value: sumBy(ok, s => s.paid), fmt: 'money', tone: 'good' },
      { label: 'Due', value: sumBy(ok, s => s.due), fmt: 'money', sub: `${ok.filter(s => s.due > 0).length} on credit`, tone: ok.some(s => s.due > 0) ? 'bad' : 'good' },
    ],
    tables: [{
      title: 'Sales',
      cols: [{ key: 'day', label: 'Date' }, { key: 'dueDay', label: 'Due date' }, { key: 'time', label: 'Time' }, { key: 'no', label: 'Bill' }, { key: 'name', label: 'Customer' }, { key: 'items', label: 'Items' },
        { key: 'qty', label: 'Qty' }, { key: 'discount', label: 'Discount', fmt: 'money' }, { key: 'total', label: 'Total', fmt: 'money' }, { key: 'paid', label: 'Paid', fmt: 'money' },
        { key: 'due', label: 'Due', fmt: 'money' }, { key: 'mode', label: 'Paid by' }, { key: 'status', label: 'Status' }],
      rows: ok.map(row),
      total: { day: `Total · ${ok.length} sales`, qty: qtyOf(itemTotals(ok)), discount: sumBy(ok, s => s.discount), total: sumBy(ok, s => s.total), paid: sumBy(ok, s => s.paid), due: sumBy(ok, s => s.due) },
      empty: 'No sales in this period.',
    }],
  };
}

export function customersReport(inp: ReportInput): Report {
  const ok = salesOf(inp, inp.range);
  const rows = Array.from(groupBy(ok, customerKey), ([key, list]) => {
    const days = list.map(s => s.day).sort();
    const named = list.find(s => s.phone) ?? list[0];
    const sales = sumBy(list, s => s.total);
    return { key, name: key === 'walk-in' ? 'Walk-in' : named.name, phone: named.phone ? formatPhone(named.phone) : '', bills: list.length, qty: qtyOf(itemTotals(list)),
      sales, avg: Math.round(sales / list.length), first: key === 'walk-in' ? '' : showDay(days[0]), last: key === 'walk-in' ? '' : showDay(days[days.length - 1]),
      paid: sumBy(list, s => s.paid), due: sumBy(list, s => s.due) || null };
  }).sort((a, b) => b.sales - a.sales);
  const named = rows.filter(r => r.key !== 'walk-in');
  const walk = rows.find(r => r.key === 'walk-in');
  const total = sumBy(rows, r => r.sales);
  return {
    title: 'Customer-wise sales',
    note: `${note(inp)} · walk-in sales are one row; customers are matched by mobile number`,
    stats: [
      { label: 'Named customers', value: named.length, fmt: 'int' },
      { label: 'Came back', value: named.filter(r => r.bills > 1).length, fmt: 'int', sub: 'more than one sale', tone: 'good' },
      { label: 'Walk-in sales', value: walk?.sales ?? 0, fmt: 'money', sub: total ? `${Math.round(((walk?.sales ?? 0) / total) * 100)}% of sales` : undefined },
      { label: 'Top customer', value: named[0]?.name ?? '—', sub: named[0] ? inr(named[0].sales) : undefined },
    ],
    tables: [{
      title: 'By customer',
      cols: [{ key: 'name', label: 'Customer' }, { key: 'phone', label: 'Mobile' }, { key: 'bills', label: 'Sales', fmt: 'int' }, { key: 'qty', label: 'Qty' },
        { key: 'sales', label: 'Amount', fmt: 'money' }, { key: 'avg', label: 'Avg bill', fmt: 'money' }, { key: 'first', label: 'First' }, { key: 'last', label: 'Last' },
        { key: 'paid', label: 'Paid', fmt: 'money' }, { key: 'due', label: 'Due', fmt: 'money' }],
      rows,
      total: { name: `Total · ${rows.length}`, bills: ok.length, qty: qtyOf(itemTotals(ok)), sales: total, avg: ok.length ? Math.round(total / ok.length) : 0, paid: sumBy(rows, r => r.paid), due: sumBy(rows, r => r.due ?? 0) },
      empty: 'No sales in this period.',
    }],
  };
}

// Quantity of each sweet per day (per month for long periods), with the total and sales.
export function itemDayReport(inp: ReportInput): Report {
  const ok = salesOf(inp, inp.range);
  const b = bucketOf(inp.range);
  const keys = Array.from(new Set(ok.map(s => b.key(s.day)))).sort();
  const items = itemTotals(ok).sort((x, y) => y.revenue - x.revenue);
  const per = new Map(keys.map(k => [k, itemTotals(ok.filter(s => b.key(s.day) === k))]));
  const cell = (k: string, key: string) => { const t = per.get(k)?.find(x => x.key === key); return t ? formatSize(t.amount, t.unit) : ''; };
  const byDay = keys.map(k => ({ k, sales: sumBy(ok.filter(s => b.key(s.day) === k), s => s.total) })).sort((x, y) => y.sales - x.sales);
  return {
    title: 'Item × day',
    note: `How much of each sweet went each ${b.label === 'Date' ? 'day' : 'month'}. ${note(inp)}; amounts are before bill discounts.`,
    stats: [
      { label: 'Items sold', value: items.length, fmt: 'int' },
      { label: `Busiest ${b.label === 'Date' ? 'day' : 'month'}`, value: byDay[0] ? b.show(byDay[0].k) : '—', sub: byDay[0] ? inr(byDay[0].sales) : undefined },
      { label: 'Top item', value: items[0]?.name ?? '—', sub: items[0] ? formatSize(items[0].amount, items[0].unit) : undefined },
      { label: 'Slowest item', value: items[items.length - 1]?.name ?? '—', sub: items.length ? formatSize(items[items.length - 1].amount, items[items.length - 1].unit) : undefined },
    ],
    tables: [{
      title: 'Quantity by item',
      cols: [{ key: 'name', label: 'Item' }, ...keys.map(k => ({ key: k, label: b.show(k) })), { key: 'total', label: 'Total' }, { key: 'sales', label: 'Sales', fmt: 'money' as const }],
      rows: items.map(t => ({ name: t.name, ...Object.fromEntries(keys.map(k => [k, cell(k, t.key)])), total: formatSize(t.amount, t.unit), sales: t.revenue })),
      total: { name: 'Total', ...Object.fromEntries(keys.map(k => [k, qtyOf(per.get(k) ?? [])])), total: qtyOf(items), sales: sumBy(items, t => t.revenue) },
      empty: 'Nothing sold in this period.',
    }],
  };
}

