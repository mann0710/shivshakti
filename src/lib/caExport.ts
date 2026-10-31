import type { Report, Table, Range } from './reports/model';
import { rangeLabel, showDay, inRange } from './reports/model';
import { MoneyData, receiptsIn, debtsOf, sumOf, MODE_NAME } from './moneyView';
import { Spend, spendsIn, SCOPES, SPEND_MODES } from './spends';
import { billNumber } from './receipt';
import { handedOverOn, istDay } from './preorders';
import { isCancelled } from './dues';

// "Download for your CA": one file with the sales register, payments, dues and spends of a period.

export type CaPart = 'sales' | 'payments' | 'dues' | 'spends';
export const CA_PARTS: [CaPart, string][] = [
  ['sales', 'Sales register (invoices and sweets bills)'], ['payments', 'Payments received'], ['dues', 'Still to collect'], ['spends', 'Spends'],
];

function salesTable(d: MoneyData, r: Range): Table {
  const inv = d.invoices.filter(i => i.booking?.status !== 'cancelled' && inRange(i.issue_date, r)).map(i => ({
    day: i.issue_date, no: i.invoice_number, name: i.booking?.customer?.name ?? '', phone: i.booking?.customer?.phone ?? '', gstin: i.booking?.customer?.gstin ?? '',
    type: 'Catering', taxable: i.total_amount - i.gst_amount, gst: i.gst_amount, total: i.total_amount,
  }));
  const bills = d.orders.filter(o => !isCancelled(o) && inRange(istDay(o.created_at), r)).map(o => ({
    day: istDay(o.created_at), no: `Bill #${billNumber(o.bill_no, o.id)}`, name: o.customer_name, phone: o.phone, gstin: '', type: 'Sweets', taxable: o.total_amount, gst: 0, total: o.total_amount,
  }));
  const pre = d.preorders.filter(p => p.status === 'delivered' && inRange(handedOverOn(p), r)).map(p => ({
    day: handedOverOn(p)!, no: 'Pre-booking', name: p.customer_name, phone: p.phone, gstin: '', type: 'Sweets', taxable: p.total_amount, gst: 0, total: p.total_amount,
  }));
  const rows = [...inv, ...bills, ...pre].sort((a, b) => a.day.localeCompare(b.day)).map(x => ({ ...x, day: showDay(x.day) }));
  return {
    title: 'Sales register',
    cols: [{ key: 'day', label: 'Date' }, { key: 'no', label: 'Number' }, { key: 'name', label: 'Customer' }, { key: 'phone', label: 'Mobile' }, { key: 'gstin', label: 'GSTIN' },
      { key: 'type', label: 'Type' }, { key: 'taxable', label: 'Taxable value', fmt: 'money' }, { key: 'gst', label: 'GST', fmt: 'money' }, { key: 'total', label: 'Total', fmt: 'money' }],
    rows, total: { day: 'Total', taxable: sumOf(rows, x => x.taxable), gst: sumOf(rows, x => x.gst), total: sumOf(rows, x => x.total) }, empty: 'No sales in this period.',
  };
}

function paymentsTable(d: MoneyData, r: Range): Table {
  const rows = receiptsIn(d, r).reverse().map(x => ({ day: showDay(x.day), who: x.who, what: x.what, type: x.source === 'catering' ? 'Catering' : 'Sweets', mode: MODE_NAME[x.mode], amount: x.amount }));
  return {
    title: 'Payments received',
    cols: [{ key: 'day', label: 'Date' }, { key: 'who', label: 'From' }, { key: 'what', label: 'For' }, { key: 'type', label: 'Type' }, { key: 'mode', label: 'Paid by' }, { key: 'amount', label: 'Amount', fmt: 'money' }],
    rows, total: { day: 'Total', amount: sumOf(rows, x => x.amount) }, empty: 'No payments in this period.',
  };
}

function duesTable(d: MoneyData, today: string): Table {
  const rows = debtsOf(d, today).map(x => ({ name: x.name, phone: x.phone, what: x.line, days: x.days ?? 0, amount: x.amount }));
  return {
    title: `Still to collect (as of ${showDay(today)})`,
    cols: [{ key: 'name', label: 'Customer' }, { key: 'phone', label: 'Mobile' }, { key: 'what', label: 'For' }, { key: 'days', label: 'Days', fmt: 'int' }, { key: 'amount', label: 'Amount', fmt: 'money' }],
    rows, total: { name: 'Total', amount: sumOf(rows, x => x.amount) }, empty: 'Nothing to collect.',
  };
}

function spendsTable(spends: Spend[], d: MoneyData, r: Range): Table {
  const event = new Map(d.bookings.map(b => [b.id, `${b.customer?.name ?? 'Customer'} · ${b.event_type} ${showDay(b.event_date)}`]));
  const scope = new Map(SCOPES);
  const mode = new Map(SPEND_MODES);
  const rows = spendsIn(spends, r).sort((a, b) => a.spent_on.localeCompare(b.spent_on)).map(s => ({
    day: showDay(s.spent_on), kind: s.kind, for: s.scope === 'event' ? event.get(s.booking_id ?? '') ?? 'An event' : scope.get(s.scope), mode: mode.get(s.mode), note: s.note ?? '', amount: s.amount,
  }));
  return {
    title: 'Spends',
    cols: [{ key: 'day', label: 'Date' }, { key: 'kind', label: 'What for' }, { key: 'for', label: 'For' }, { key: 'mode', label: 'Paid by' }, { key: 'note', label: 'Note' }, { key: 'amount', label: 'Amount', fmt: 'money' }],
    rows, total: { day: 'Total', amount: sumOf(rows, x => x.amount) }, empty: 'No spends noted in this period.',
  };
}

export function caReport(d: MoneyData, spends: Spend[], r: Range, today: string, parts: CaPart[]): Report {
  const tables: Record<CaPart, () => Table> = {
    sales: () => salesTable(d, r), payments: () => paymentsTable(d, r), dues: () => duesTable(d, today), spends: () => spendsTable(spends, d, r),
  };
  const built = parts.map(p => tables[p]());
  const total = (t?: Table) => Number(t?.total?.total ?? t?.total?.amount ?? 0);
  return {
    title: 'For the CA',
    note: `${rangeLabel(r)} · catering and sweets together · cancelled bookings left out`,
    stats: parts.map((p, i) => ({ label: CA_PARTS.find(x => x[0] === p)![1], value: total(built[i]), fmt: 'money' as const })),
    tables: built,
  };
}
