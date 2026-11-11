import type { CartLine, ItemTotal } from '../cart';
import { totalsByItem } from '../cart';
import { nameKey } from '../itemCatalog';
import { Payment, billPayments, preorderPayments, isMoney, modeOf, MODE_LABEL } from '../payments';
import { billDue, bookingDue, isCancelled } from '../dues';
import { handedOverOn, istDay } from '../preorders';
import { billNumber } from '../receipt';
import { formatSize, PriceUnit, roundMoney } from '../units';
import { cleanPhone } from '../money';
import { WALK_IN } from '../posForm';
import { Range, inRange, sumBy, addDays, spanDays } from './model';
import { ReportInput } from './input';

// One sale for the detailed reports: a counter bill (cancelled ones too) or a pre-booking on the day it was handed over.

export interface Sale {
  kind: 'bill' | 'booking';
  no: string;
  at: string;         // ISO time of the sale
  day: string;
  name: string;
  phone: string;
  lines: CartLine[];
  subtotal: number;
  discount: number;
  total: number;
  paid: number;       // money received on it so far
  due: number;
  mode: string;       // Cash, UPI, Cash + UPI, Credit, Not paid
  cancelled: boolean;
  reason: string;
  payments: Payment[];
  occasion_id?: string;
}

const modeText = (list: Payment[], due: number) => {
  const m = modeOf(list);
  return m ? MODE_LABEL[m] + (due > 0 ? ' + credit' : '') : due > 0 ? 'Credit' : '—';
};

export function salesOf(inp: Pick<ReportInput, 'orders' | 'preorders' | 'occasionId'>, r: Range): Sale[] {
  const occ = <T extends { occasion_id?: string }>(x: T) => !inp.occasionId || x.occasion_id === inp.occasionId;
  const bills = inp.orders.filter(o => occ(o) && inRange(istDay(o.created_at), r)).map((o): Sale => {
    const list = billPayments(o);
    const due = billDue(o);
    return {
      kind: 'bill', no: `#${billNumber(o.bill_no, o.id)}`, at: o.created_at, day: istDay(o.created_at), name: o.customer_name, phone: o.phone ?? '',
      lines: o.items ?? [], subtotal: o.subtotal, discount: o.discount_amount, total: o.total_amount,
      paid: sumBy(list.filter(isMoney), p => p.amount), due, mode: modeText(list, due), cancelled: isCancelled(o), reason: o.cancel_reason ?? '',
      payments: list, occasion_id: o.occasion_id,
    };
  });
  const given = inp.preorders.filter(p => occ(p) && inRange(handedOverOn(p), r)).map((p): Sale => {
    const list = preorderPayments(p);
    const due = bookingDue(p);
    const day = handedOverOn(p)!;
    return {
      kind: 'booking', no: `PB-${p.id.slice(0, 4).toUpperCase()}`, at: p.delivered_at || `${day}T12:00:00+05:30`, day, name: p.customer_name, phone: p.phone ?? '',
      lines: p.items ?? [], subtotal: p.subtotal, discount: p.discount_amount, total: p.total_amount,
      paid: sumBy(list.filter(isMoney), x => x.amount), due, mode: modeText(list, due), cancelled: false, reason: '', payments: list, occasion_id: p.occasion_id,
    };
  });
  return [...bills, ...given].sort((a, b) => b.at.localeCompare(a.at));
}

export const live = (list: Sale[]) => list.filter(s => !s.cancelled);
export const itemTotals = (list: Sale[]): ItemTotal[] => totalsByItem(list.flatMap(s => s.lines), l => nameKey(l.item_name));

// "12.5 kg, 40 pcs".
export function qtyOf(totals: ItemTotal[]): string {
  const per = new Map<PriceUnit, number>();
  totals.forEach(t => per.set(t.unit, (per.get(t.unit) ?? 0) + t.amount));
  return Array.from(per, ([u, n]) => formatSize(n, u)).join(', ');
}

export const customerKey = (s: Pick<Sale, 'name' | 'phone'>) =>
  (cleanPhone(s.phone) || (s.name === WALK_IN ? '' : s.name.trim().toLowerCase())) || 'walk-in';

// Headline numbers for one period, used by the summary and its comparisons.
export interface Totals { gross: number; discount: number; net: number; sales: number; avg: number; items: number; qty: string; cancelled: number; cancelledValue: number; refunds: number; cash: number; upi: number; credit: number }

export function totalsOf(list: Sale[]): Totals {
  const ok = live(list);
  const net = sumBy(ok, s => s.total);
  const lines = ok.reduce((n, s) => n + s.lines.length, 0);
  const atSale = ok.flatMap(s => s.payments.filter(p => isMoney(p) && p.amount > 0 && istDay(p.at) === s.day));
  const gone = list.filter(s => s.cancelled);
  return {
    gross: sumBy(ok, s => s.subtotal), discount: sumBy(ok, s => s.discount), net, sales: ok.length,
    avg: ok.length ? Math.round(net / ok.length) : 0, items: ok.length ? Math.round((lines / ok.length) * 10) / 10 : 0, qty: qtyOf(itemTotals(ok)),
    cancelled: gone.length, cancelledValue: sumBy(gone, s => s.total),
    refunds: Math.abs(sumBy(list.flatMap(s => s.payments.filter(p => p.kind === 'refund')), p => p.amount)),
    cash: sumBy(atSale.filter(p => p.mode === 'cash'), p => p.amount), upi: sumBy(atSale.filter(p => p.mode === 'upi'), p => p.amount),
    credit: roundMoney(sumBy(ok, s => Math.max(0, s.total - sumBy(s.payments.filter(p => isMoney(p) && istDay(p.at) <= s.day), p => p.amount)))),
  };
}

// The same number of days just before, and the same dates a year earlier.
export const previousRange = (r: Range): Range => ({ from: addDays(r.from, -spanDays(r)), to: addDays(r.from, -1) });
export const lastYearRange = (r: Range): Range => {
  const back = (d: string) => `${Number(d.slice(0, 4)) - 1}${d.slice(4) === '-02-29' ? '-02-28' : d.slice(4)}`;
  return { from: back(r.from), to: back(r.to) };
};

// "+18%", "−4%", or '' when there is nothing to compare with.
export const change = (now: number, before: number) => (!before ? '' : `${now >= before ? '+' : '−'}${Math.abs(Math.round(((now - before) / before) * 100))}%`);
