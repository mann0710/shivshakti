import { isMoney } from '../payments';
import { istDay } from '../preorders';
import { creditItems, ageBucket, ageOf, AGES } from '../credit/items';
import { accountsOf } from '../credit/accounts';
import { DEFAULT_CREDIT } from '../credit/types';
import { formatPhone } from '../people';
import { inr } from '../money';
import { Report, sumBy, groupBy, inRange, bucketOf, showDay } from './model';
import { ReportInput } from './input';

// Credit: given vs got back in the period, who owes by age right now, open promises and what was let go.
export function creditReport(inp: ReportInput): Report {
  const r = inp.range;
  const orders = Array.from(new Map([...inp.orders, ...inp.unpaidOrders].map(o => [o.id, o])).values());
  const entries = inp.credit ?? [];
  const items = creditItems(orders, inp.preorders, entries, DEFAULT_CREDIT.pay_days);
  const accounts = accountsOf(items, entries, [], DEFAULT_CREDIT, inp.today).filter(a => a.owed > 0).sort((a, b) => b.owed - a.owed);

  const given = items.filter(i => !i.cancelled && inRange(i.day, r));
  const back = [
    ...items.flatMap(i => i.payments.filter(p => isMoney(p) && p.kind === 'due').map(p => ({ day: istDay(p.at), mode: p.mode, amount: p.amount }))),
    ...entries.filter(e => e.kind === 'receipt' && !e.voided_at && e.mode).map(e => ({ day: istDay(e.at), mode: e.mode!, amount: e.amount - e.links.reduce((s, l) => s + l.amount, 0) })).filter(x => x.amount > 0),
  ].filter(x => inRange(x.day, r));
  const letGo = items.flatMap(i => i.payments.filter(p => p.kind === 'writeoff' && inRange(istDay(p.at), r)));

  const b = bucketOf(r);
  const keys = Array.from(new Set([...given.map(i => b.key(i.day)), ...back.map(x => b.key(x.day))])).sort().reverse();
  const givenBy = groupBy(given, i => b.key(i.day));
  const backBy = groupBy(back, x => b.key(x.day));
  const days = keys.map(k => {
    const g = sumBy(givenBy.get(k) ?? [], i => i.given);
    const got = sumBy(backBy.get(k) ?? [], x => x.amount);
    return { day: b.show(k), given: g, got, net: g - got };
  });

  const aging = accounts.map(a => {
    const by = AGES.map((_, n) => sumBy(a.open.filter(i => ageBucket(ageOf(i, inp.today)) === n), i => i.due));
    return { name: a.name, phone: formatPhone(a.phone), a0: by[0], a1: by[1], a2: by[2], a3: by[3], total: a.owed };
  });
  const promises = accounts.filter(a => a.promise).map(a => ({
    name: a.name, by: showDay(a.promise!.date), amount: a.promise!.amount || a.owed, status: a.promise!.broken ? 'Missed' : 'Open',
  }));
  const owed = sumBy(accounts, a => a.owed);

  return {
    title: 'Credit',
    note: 'Sweets given on credit and paid back later. "Still to collect" is as of today, whatever the period.',
    stats: [
      { label: 'Given on credit', value: sumBy(given, i => i.given), fmt: 'money', sub: `${given.length} bills` },
      { label: 'Got back', value: sumBy(back, x => x.amount), fmt: 'money', sub: `Cash ${inr(sumBy(back.filter(x => x.mode === 'cash'), x => x.amount))} · UPI ${inr(sumBy(back.filter(x => x.mode === 'upi'), x => x.amount))}`, tone: 'good' },
      { label: 'Still to collect', value: owed, fmt: 'money', sub: `${accounts.length} customers`, tone: owed ? 'bad' : 'good' },
      { label: 'Let go / written off', value: sumBy(letGo, p => p.amount), fmt: 'money', sub: `${letGo.length} entries` },
    ],
    tables: [
      { title: 'Given vs got back', cols: [{ key: 'day', label: b.label }, { key: 'given', label: 'Given', fmt: 'money' }, { key: 'got', label: 'Got back', fmt: 'money' }, { key: 'net', label: 'Net', fmt: 'money' }],
        rows: days, total: { day: 'Total', given: sumBy(days, d => d.given), got: sumBy(days, d => d.got), net: sumBy(days, d => d.net) }, empty: 'No credit given or paid back in this period.' },
      { title: 'Who owes, by age of each bill', cols: [{ key: 'name', label: 'Customer' }, { key: 'phone', label: 'Mobile' },
        ...AGES.map((l, n) => ({ key: `a${n}`, label: l, fmt: 'money' as const })), { key: 'total', label: 'Total', fmt: 'money' }],
        rows: aging, total: { name: `Total · ${aging.length} customers`, phone: '', a0: sumBy(aging, x => x.a0), a1: sumBy(aging, x => x.a1), a2: sumBy(aging, x => x.a2), a3: sumBy(aging, x => x.a3), total: owed },
        empty: 'Nobody owes you anything.' },
      { title: 'Promises to pay', cols: [{ key: 'name', label: 'Customer' }, { key: 'by', label: 'Pay by' }, { key: 'amount', label: 'Amount', fmt: 'money' }, { key: 'status', label: 'Status' }],
        rows: promises, empty: 'No open promises.' },
    ],
  };
}
