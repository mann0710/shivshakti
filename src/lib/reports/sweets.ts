import { totalsByItem, ItemTotal } from '../cart';
import { nameKey } from '../itemCatalog';
import { formatSize, formatLineSize, unitFromLine, PriceUnit } from '../units';
import { cleanPhone, inr } from '../money';
import { handedOverOn, istDay } from '../preorders';
import { WALK_IN } from '../posForm';
import { billDue } from '../dues';
import { Report, Row, sumBy, share, groupBy, bucketOf } from './model';
import { ReportInput, billsIn, handedOverIn, soldLines, categoryOf, occasionName, occasionNote } from './input';

const salesNote = (inp: ReportInput) => `Counter bills + pre-bookings handed over in the period${occasionNote(inp)}`;
// Line totals are before the bill-level discount, so say how much that was.
const itemNote = (inp: ReportInput) => {
  const off = sumBy([...billsIn(inp), ...handedOverIn(inp)], o => o.discount_amount);
  return `${salesNote(inp)}${off ? ` · item revenue is before bill discounts of ${inr(off)}` : ''}`;
};

// Mixed units read as "12.5 kg, 40 pcs".
const qtyText = (list: ItemTotal[]) => {
  const per = new Map<PriceUnit, number>();
  list.forEach(t => per.set(t.unit, (per.get(t.unit) ?? 0) + t.amount));
  return Array.from(per, ([u, n]) => formatSize(n, u)).join(', ');
};

export function salesReport(inp: ReportInput): Report {
  const bills = billsIn(inp);
  const given = handedOverIn(inp);
  const billSales = sumBy(bills, o => o.total_amount);
  const preSales = sumBy(given, p => p.total_amount);
  const total = billSales + preSales;
  const unpaid = bills.filter(o => billDue(o) > 0);
  const b = bucketOf(inp.range);

  const days = new Map<string, Row>();
  const at = (day: string) => {
    const k = b.key(day);
    if (!days.has(k)) days.set(k, { day: b.show(k), bills: 0, billSales: 0, given: 0, preSales: 0, discount: 0, total: 0 });
    return days.get(k)!;
  };
  const add = (r: Row, f: string, n: number) => { r[f] = (Number(r[f]) || 0) + n; };
  bills.forEach(o => { const r = at(istDay(o.created_at)); add(r, 'bills', 1); add(r, 'billSales', o.total_amount); add(r, 'discount', o.discount_amount); add(r, 'total', o.total_amount); });
  given.forEach(p => { const r = at(handedOverOn(p)!); add(r, 'given', 1); add(r, 'preSales', p.total_amount); add(r, 'discount', p.discount_amount); add(r, 'total', p.total_amount); });
  const dayRows = Array.from(days.keys()).sort().map(k => days.get(k)!);

  const occ = groupBy([...bills.map(o => ({ id: o.occasion_id, bill: 1, pre: 0, v: o.total_amount })), ...given.map(p => ({ id: p.occasion_id, bill: 0, pre: 1, v: p.total_amount }))], x => x.id ?? '');
  const occRows = Array.from(occ, ([id, list]) => ({ name: occasionName(inp, id || undefined), bills: sumBy(list, x => x.bill), pre: sumBy(list, x => x.pre), sales: sumBy(list, x => x.v) }))
    .sort((x, y) => y.sales - x.sales).map(r => ({ ...r, share: share(r.sales, total) }));

  return {
    title: 'Sales report',
    note: salesNote(inp),
    stats: [
      { label: 'Total sales', value: total, fmt: 'money', sub: `${bills.length + given.length} sales` },
      { label: 'Counter bills', value: billSales, fmt: 'money', sub: `${bills.length} bills · avg ${inr(bills.length ? Math.round(billSales / bills.length) : 0)}` },
      { label: 'Pre-bookings handed over', value: preSales, fmt: 'money', sub: `${given.length} orders` },
      { label: 'Unpaid bills (this period)', value: sumBy(unpaid, billDue), fmt: 'money', sub: `${unpaid.length} bills`, tone: unpaid.length ? 'bad' : 'good' },
    ],
    tables: [
      {
        title: b.label === 'Date' ? 'Day by day' : 'Month by month',
        cols: [{ key: 'day', label: b.label }, { key: 'bills', label: 'Bills', fmt: 'int' }, { key: 'billSales', label: 'Counter sales', fmt: 'money' },
          { key: 'given', label: 'Pre-bookings', fmt: 'int' }, { key: 'preSales', label: 'Pre-booking sales', fmt: 'money' },
          { key: 'discount', label: 'Discount', fmt: 'money' }, { key: 'total', label: 'Total sales', fmt: 'money' }],
        rows: dayRows,
        total: { day: 'Total', bills: bills.length, billSales, given: given.length, preSales, discount: sumBy(dayRows, r => Number(r.discount)), total },
        empty: 'No sales in this period.',
      },
      {
        title: 'By occasion',
        cols: [{ key: 'name', label: 'Occasion' }, { key: 'bills', label: 'Bills', fmt: 'int' }, { key: 'pre', label: 'Pre-bookings', fmt: 'int' },
          { key: 'sales', label: 'Sales', fmt: 'money' }, { key: 'share', label: 'Share', fmt: 'pct' }],
        rows: occRows,
        empty: 'No sales in this period.',
      },
    ],
  };
}

export function itemsReport(inp: ReportInput): Report {
  const lines = soldLines(inp);
  const cat = categoryOf(inp);
  const items = totalsByItem(lines, l => nameKey(l.item_name)).sort((a, b) => b.revenue - a.revenue);
  const revenue = sumBy(items, t => t.revenue);
  const catOf = new Map(lines.map(l => [`${nameKey(l.item_name)}|${unitFromLine(l.weight_unit)}`, cat(l)]));

  const packs = groupBy(lines, l => `${nameKey(l.item_name)}|${l.weight}|${l.weight_unit}`);
  const packRows = Array.from(packs.values()).map(list => ({
    item: items.find(t => t.key === `${nameKey(list[0].item_name)}|${unitFromLine(list[0].weight_unit)}`)?.name ?? list[0].item_name,
    pack: formatLineSize(list[0].weight, list[0].weight_unit), w: list[0].weight,
    count: sumBy(list, l => l.qty), revenue: sumBy(list, l => l.line_total),
  })).sort((a, b) => a.item.localeCompare(b.item) || a.w - b.w);

  return {
    title: 'Item-wise sales',
    note: itemNote(inp),
    stats: [
      { label: 'Revenue', value: revenue, fmt: 'money' },
      { label: 'Items sold', value: items.length, fmt: 'int', sub: 'different sweets' },
      { label: 'Packs sold', value: sumBy(items, t => t.packs), fmt: 'int' },
      { label: 'Quantity', value: qtyText(items) || '—', sub: 'by weight / pieces' },
    ],
    tables: [
      {
        title: 'Item-wise',
        cols: [{ key: 'name', label: 'Item' }, { key: 'cat', label: 'Category' }, { key: 'packs', label: 'Packs', fmt: 'int' },
          { key: 'qty', label: 'Quantity' }, { key: 'revenue', label: 'Revenue', fmt: 'money' }, { key: 'share', label: 'Share', fmt: 'pct' }],
        rows: items.map(t => ({ name: t.name, cat: catOf.get(t.key), packs: t.packs, qty: formatSize(t.amount, t.unit), revenue: t.revenue, share: share(t.revenue, revenue) })),
        total: { name: 'Total', packs: sumBy(items, t => t.packs), qty: qtyText(items), revenue, share: revenue ? 100 : 0 },
        empty: 'Nothing sold in this period.',
      },
      {
        title: 'By pack size',
        cols: [{ key: 'item', label: 'Item' }, { key: 'pack', label: 'Pack' }, { key: 'count', label: 'Sold', fmt: 'int' }, { key: 'revenue', label: 'Revenue', fmt: 'money' }],
        rows: packRows,
        empty: 'Nothing sold in this period.',
      },
    ],
  };
}

export function categoryReport(inp: ReportInput): Report {
  const cat = categoryOf(inp);
  const groups = groupBy(soldLines(inp), cat);
  const rows = Array.from(groups, ([name, list]) => {
    const t = totalsByItem(list, l => nameKey(l.item_name));
    return { name, items: t.length, packs: sumBy(t, x => x.packs), qty: qtyText(t), revenue: sumBy(t, x => x.revenue) };
  }).sort((a, b) => b.revenue - a.revenue);
  const revenue = sumBy(rows, r => r.revenue);
  return {
    title: 'Category-wise sales',
    note: `${itemNote(inp)} · set categories in Sessional Items`,
    stats: [
      { label: 'Revenue', value: revenue, fmt: 'money' },
      { label: 'Categories', value: rows.length, fmt: 'int' },
      { label: 'Top category', value: rows[0]?.name ?? '—', sub: rows[0] ? `${share(rows[0].revenue, revenue)}% of sales` : undefined },
      { label: 'Packs sold', value: sumBy(rows, r => r.packs), fmt: 'int' },
    ],
    tables: [{
      title: 'By category',
      cols: [{ key: 'name', label: 'Category' }, { key: 'items', label: 'Items', fmt: 'int' }, { key: 'packs', label: 'Packs', fmt: 'int' },
        { key: 'qty', label: 'Quantity' }, { key: 'revenue', label: 'Revenue', fmt: 'money' }, { key: 'share', label: 'Share', fmt: 'pct' }],
      rows: rows.map(r => ({ ...r, share: share(r.revenue, revenue) })),
      total: { name: 'Total', packs: sumBy(rows, r => r.packs), revenue, share: revenue ? 100 : 0 },
      empty: 'Nothing sold in this period.',
    }],
  };
}

export function topReport(inp: ReportInput): Report {
  const items = totalsByItem(soldLines(inp), l => nameKey(l.item_name)).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  const sales = [
    ...billsIn(inp).map(o => ({ name: o.customer_name, phone: o.phone, bill: 1, pre: 0, v: o.total_amount, day: istDay(o.created_at) })),
    ...handedOverIn(inp).map(p => ({ name: p.customer_name, phone: p.phone, bill: 0, pre: 1, v: p.total_amount, day: handedOverOn(p)! })),
  ].filter(s => s.name !== WALK_IN || s.phone);
  const people = Array.from(groupBy(sales, s => cleanPhone(s.phone ?? '') || s.name.trim().toLowerCase()).values())
    .map(list => ({ name: list[0].name, phone: list[0].phone, bills: sumBy(list, s => s.bill), pre: sumBy(list, s => s.pre), spend: sumBy(list, s => s.v), last: list.map(s => s.day).sort().pop() }))
    .sort((a, b) => b.spend - a.spend).slice(0, 10);
  const events = inp.bookings.filter(b => b.status !== 'cancelled' && b.event_date >= inp.range.from && b.event_date <= inp.range.to);
  const caterers = Array.from(groupBy(events, b => b.customer_id).values())
    .map(list => ({ name: list[0].customer?.name ?? '—', phone: list[0].customer?.phone ?? '', events: list.length, value: sumBy(list, inp.bookingValue) }))
    .sort((a, b) => b.value - a.value).slice(0, 10);
  const rank = <T,>(l: T[]) => l.map((r, i) => ({ rank: i + 1, ...r }));

  return {
    title: 'Top items & customers',
    note: salesNote(inp),
    stats: [
      { label: 'Best seller', value: items[0]?.name ?? '—', sub: items[0] ? `${formatSize(items[0].amount, items[0].unit)} sold` : undefined },
      { label: 'Top sweets customer', value: people[0]?.name ?? '—', sub: people[0] ? inr(people[0].spend) : undefined },
      { label: 'Repeat customers', value: people.filter(p => p.bills + p.pre > 1).length, fmt: 'int', sub: 'in top 10' },
      { label: 'Top catering client', value: caterers[0]?.name ?? '—', sub: caterers[0] ? inr(caterers[0].value) : undefined },
    ],
    tables: [
      { title: 'Top 10 items', cols: [{ key: 'rank', label: '#' }, { key: 'name', label: 'Item' }, { key: 'packs', label: 'Packs', fmt: 'int' }, { key: 'qty', label: 'Quantity' }, { key: 'revenue', label: 'Revenue', fmt: 'money' }],
        rows: rank(items.map(t => ({ name: t.name, packs: t.packs, qty: formatSize(t.amount, t.unit), revenue: t.revenue }))), empty: 'Nothing sold in this period.' },
      { title: 'Top 10 sweets customers', cols: [{ key: 'rank', label: '#' }, { key: 'name', label: 'Customer' }, { key: 'phone', label: 'Mobile' }, { key: 'bills', label: 'Bills', fmt: 'int' }, { key: 'pre', label: 'Pre-bookings', fmt: 'int' }, { key: 'spend', label: 'Spent', fmt: 'money' }],
        rows: rank(people), empty: 'No named customers in this period.' },
      { title: 'Top catering customers (events in period)', cols: [{ key: 'rank', label: '#' }, { key: 'name', label: 'Customer' }, { key: 'phone', label: 'Mobile' }, { key: 'events', label: 'Events', fmt: 'int' }, { key: 'value', label: 'Value', fmt: 'money' }],
        rows: rank(caterers), empty: 'No catering events in this period.' },
    ],
  };
}
