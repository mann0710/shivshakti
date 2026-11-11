import { inr } from '../money';
import { istDay } from '../preorders';
import { Report, sumBy, groupBy, share, showDay } from './model';
import { ReportInput, occasionNote, leftOut, cancelledBillsIn } from './input';
import { Sale, salesOf } from './sales';

// When people buy (hour and weekday), and what did not come in (discounts, take-backs, credit let go).

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const istHour = (iso: string) => Number(new Date(iso).toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' })) % 24;
const hourLabel = (h: number) => { const f = (n: number) => `${n % 12 || 12}${n < 12 || n === 24 ? ' AM' : ' PM'}`; return `${f(h)} – ${f(h + 1)}`; };
const weekday = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();

export function hoursReport(inp: ReportInput): Report {
  const bills = salesOf(inp, inp.range).filter(s => s.kind === 'bill');
  const total = sumBy(bills, s => s.total);
  const hours = Array.from(groupBy(bills, s => String(istHour(s.at))), ([h, list]) => ({ h: Number(h), bills: list.length, sales: sumBy(list, s => s.total) }))
    .sort((a, b) => a.h - b.h).map(r => ({ hour: hourLabel(r.h), bills: r.bills, sales: r.sales, avg: Math.round(r.sales / r.bills), share: share(r.sales, total), h: r.h }));
  const days = Array.from(groupBy(bills, s => String(weekday(s.day))), ([d, list]) => {
    const dates = new Set(list.map(s => s.day)).size;
    const sales = sumBy(list, s => s.total);
    return { d: Number(d), day: WEEKDAYS[Number(d)], dates, bills: list.length, sales, perDay: Math.round(sales / dates), share: share(sales, total) };
  }).sort((a, b) => a.d - b.d);
  const top = [...hours].sort((a, b) => b.sales - a.sales);
  const busyDay = [...days].sort((a, b) => b.perDay - a.perDay)[0];
  const evening = bills.filter(s => istHour(s.at) >= 18);
  return {
    title: 'Time of day',
    note: `Counter bills by the time they were made${occasionNote(inp)}; pre-bookings are left out (their hand-over time is not kept).`,
    stats: [
      { label: 'Busiest hour', value: top[0]?.hour ?? '—', sub: top[0] ? `${inr(top[0].sales)} · ${top[0].bills} bill${top[0].bills === 1 ? '' : 's'}` : undefined },
      { label: 'Quietest hour', value: top[top.length - 1]?.hour ?? '—', sub: top.length ? inr(top[top.length - 1].sales) : undefined },
      { label: 'Busiest weekday', value: busyDay?.day ?? '—', sub: busyDay ? `avg ${inr(busyDay.perDay)} a day` : undefined },
      { label: 'Avg bill after 6 PM', value: evening.length ? Math.round(sumBy(evening, s => s.total) / evening.length) : 0, fmt: 'money', sub: `${evening.length} bill${evening.length === 1 ? '' : 's'}` },
    ],
    tables: [
      { title: 'By hour', cols: [{ key: 'hour', label: 'Hour' }, { key: 'bills', label: 'Bills', fmt: 'int' }, { key: 'sales', label: 'Sales', fmt: 'money' }, { key: 'avg', label: 'Avg bill', fmt: 'money' }, { key: 'share', label: 'Share', fmt: 'pct' }],
        rows: hours, total: { hour: 'Total', bills: bills.length, sales: total, avg: bills.length ? Math.round(total / bills.length) : 0, share: total ? 100 : 0 }, empty: 'No counter bills in this period.' },
      { title: 'By weekday', cols: [{ key: 'day', label: 'Day' }, { key: 'dates', label: 'Days open', fmt: 'int' }, { key: 'bills', label: 'Bills', fmt: 'int' }, { key: 'sales', label: 'Sales', fmt: 'money' }, { key: 'perDay', label: 'Avg a day', fmt: 'money' }, { key: 'share', label: 'Share', fmt: 'pct' }],
        rows: days, empty: 'No counter bills in this period.' },
    ],
  };
}

export function discountsReport(inp: ReportInput): Report {
  const ok = salesOf(inp, inp.range);
  const off = ok.filter(s => s.discount > 0);
  const back = ok.flatMap(s => s.payments.filter(p => p.kind === 'refund').map(p => ({ s, p })));
  const letGo = ok.flatMap(s => s.payments.filter(p => p.kind === 'writeoff').map(p => ({ s, p })));
  const gross = sumBy(ok, s => s.subtotal);
  const row = (s: Sale, what: string, amount: number, why: string, at = s.at) => ({ day: showDay(istDay(at)), at, no: s.no, name: s.name, what, amount, why });
  const rows = [
    ...back.map(({ s, p }) => row(s, 'Take-back', Math.abs(p.amount), `Handed back by ${p.mode === 'upi' ? 'UPI' : 'cash'}`, p.at)),
    ...letGo.map(({ s, p }) => row(s, 'Credit let go', p.amount, p.note ?? '—', p.at)),
    ...off.map(s => row(s, `Discount ${s.subtotal ? Math.round((s.discount / s.subtotal) * 1000) / 10 : 0}%`, s.discount, '—')),
  ].sort((a, b) => b.at.localeCompare(a.at));
  return {
    title: 'Discounts & take-backs',
    note: `Money that did not come in on sales, and why${occasionNote(inp)}${leftOut(cancelledBillsIn(inp))}.`,
    stats: [
      { label: 'Discounts', value: sumBy(off, s => s.discount), fmt: 'money', sub: `${off.length} sales · ${share(sumBy(off, s => s.discount), gross)}% of gross`, tone: off.length ? 'warn' : 'good' },
      { label: 'Handed back', value: Math.abs(sumBy(back, x => x.p.amount)), fmt: 'money', sub: `${back.length} take-backs` },
      { label: 'Credit let go', value: sumBy(letGo, x => x.p.amount), fmt: 'money', sub: `${letGo.length} entries` },
    ],
    tables: [{
      title: 'Every discount and take-back',
      cols: [{ key: 'day', label: 'Date' }, { key: 'no', label: 'Bill' }, { key: 'name', label: 'Customer' }, { key: 'what', label: 'What' }, { key: 'amount', label: 'Amount', fmt: 'money' }, { key: 'why', label: 'Reason / how' }],
      rows, empty: 'No discounts or take-backs in this period.',
    }],
  };
}
