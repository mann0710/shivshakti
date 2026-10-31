import type { Booking, Invoice, Payment } from '../types';
import type { SeasonalOrder } from '../hooks/useSeasonalOrders';
import type { SeasonalPreorder } from '../hooks/useSeasonalPreorders';
import { Range, addDays, inRange } from './reports/model';
import { billPayments, preorderPayments } from './payments';
import { billDue, bookingDue, isCancelled } from './dues';
import { handedOverOn, istDay } from './preorders';
import { billNumber } from './receipt';
import { invoiceTodo, daysBetween } from './cateringTodo';
import { inr } from './money';
import { formatDateIST } from './ist';
import { roundMoney } from './units';

// Money screen maths: periods, money in, money owed and money coming, catering and sweets together.

export type Period = 'today' | 'week' | 'month' | 'season' | 'year' | 'custom';
export const PERIODS: [Period, string][] = [
  ['today', 'Today'], ['week', 'This week'], ['month', 'This month'], ['season', 'This season'], ['year', 'This year'], ['custom', 'Pick dates'],
];

// Financial year (Apr–Mar) that holds the day.
export const fyStart = (day: string) => {
  const [y, m] = day.split('-').map(Number);
  return `${m >= 4 ? y : y - 1}-04-01`;
};
const weekday = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay();

export function periodRange(p: Period, today: string, season?: Range | null, custom?: Range | null): Range {
  switch (p) {
    case 'week': return { from: addDays(today, -((weekday(today) + 6) % 7)), to: today };
    case 'month': return { from: `${today.slice(0, 7)}-01`, to: today };
    case 'season': return season ?? { from: `${today.slice(0, 7)}-01`, to: today };
    case 'year': return { from: fyStart(today), to: today };
    case 'custom': return custom && custom.from <= custom.to ? custom : { from: today, to: today };
    default: return { from: today, to: today };
  }
}

// The running (or last) season with dates, cut at today.
export function seasonRange(list: { name: string; is_active: boolean; start_date?: string | null; end_date?: string | null }[], today: string): (Range & { name: string }) | null {
  const dated = list.filter(o => o.start_date && o.start_date <= today).sort((a, b) => b.start_date!.localeCompare(a.start_date!));
  const pick = dated.find(o => o.is_active) ?? dated[0];
  if (!pick) return null;
  return { from: pick.start_date!, to: pick.end_date && pick.end_date < today ? pick.end_date : today, name: pick.name };
}

export type QuoteLite = { id: string; booking_id?: string | null; status: string; quotation_number: string; total_amount: number; total_max?: number | null; created_at: string };
export interface MoneyData {
  bookings: Booking[];
  invoices: Invoice[];
  payments: Payment[];
  quotes: QuoteLite[];
  orders: SeasonalOrder[];
  preorders: SeasonalPreorder[];
}

export type Source = 'catering' | 'sweets';
export type Mode = 'cash' | 'upi' | 'bank';
export interface Receipt { key: string; day: string; source: Source; mode: Mode; amount: number; who: string; what: string }

const MODE: Record<string, Mode> = { cash: 'cash', upi: 'upi', bank_transfer: 'bank', cheque: 'bank' };
export const MODE_NAME: Record<Mode, string> = { cash: 'Cash', upi: 'UPI', bank: 'Bank' };
const live = (inv?: Invoice) => !!inv && inv.booking?.status !== 'cancelled';
const firstItem = (items?: { item_name: string }[]) => items?.[0]?.item_name ?? 'Sweets';

// Every rupee received in the range by its payment date, newest first; cancelled bookings and bills never count.
export function receiptsIn(d: MoneyData, r: Range): Receipt[] {
  const invById = new Map(d.invoices.map(i => [i.id, i]));
  const catering = d.payments.filter(p => inRange(p.payment_date, r) && live(invById.get(p.invoice_id))).map((p): Receipt => {
    const inv = invById.get(p.invoice_id)!;
    return { key: p.id, day: p.payment_date, source: 'catering', mode: MODE[p.payment_mode] ?? 'cash', amount: Number(p.amount) || 0,
      who: inv.booking?.customer?.name ?? 'Customer', what: `${p.payment_type === 'advance' ? 'advance' : 'payment'} for ${inv.booking?.event_type ?? 'event'} (${inv.invoice_number})` };
  });
  const bills = d.orders.filter(o => !isCancelled(o)).flatMap(o => billPayments(o).map((p, i): Receipt => ({
    key: `${o.id}-${i}`, day: istDay(p.at), source: 'sweets', mode: p.mode, amount: p.amount, who: o.customer_name,
    what: `bill #${billNumber(o.bill_no, o.id)}${p.kind === 'refund' ? ' refund' : p.kind === 'due' ? ' (due paid)' : ''}`,
  })));
  const pre = d.preorders.filter(p => p.status !== 'cancelled' || p.payments?.length).flatMap(p => preorderPayments(p).map((x, i): Receipt => ({
    key: `${p.id}-${i}`, day: istDay(x.at), source: 'sweets', mode: x.mode, amount: x.amount, who: p.customer_name,
    what: `${firstItem(p.items)} pre-booking${x.kind === 'refund' ? ' refund' : x.kind === 'handover' ? ' at hand-over' : ''}`,
  })));
  return [...catering, ...bills, ...pre].filter(x => x.amount !== 0 && inRange(x.day, r)).sort((a, b) => b.day.localeCompare(a.day));
}

export const sumOf = <T,>(list: T[], f: (x: T) => number) => roundMoney(list.reduce((s, x) => s + (Number(f(x)) || 0), 0));

export function receivedSummary(list: Receipt[]) {
  const by = (f: (x: Receipt) => boolean) => sumOf(list.filter(f), x => x.amount);
  return {
    total: by(() => true), catering: by(x => x.source === 'catering'), sweets: by(x => x.source === 'sweets'),
    cash: by(x => x.mode === 'cash'), upi: by(x => x.mode === 'upi'), bank: by(x => x.mode === 'bank'),
  };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export interface MonthBar { ym: string; label: string; catering: number; sweets: number }

// Twelve months of the financial year starting at `from`, split catering vs sweets.
export function monthBars(d: MoneyData, from: string): MonthBar[] {
  const [y] = from.split('-').map(Number);
  const months = Array.from({ length: 12 }, (_, i) => { const m = (3 + i) % 12; return `${m < 3 ? y + 1 : y}-${String(m + 1).padStart(2, '0')}`; });
  const end = addDays(`${months[11]}-01`, 30);
  const list = receiptsIn(d, { from: `${months[0]}-01`, to: end });
  return months.map(ym => {
    const inMonth = list.filter(x => x.day.startsWith(ym));
    return { ym, label: MONTHS[Number(ym.slice(5)) - 1], catering: sumOf(inMonth.filter(x => x.source === 'catering'), x => x.amount), sweets: sumOf(inMonth.filter(x => x.source === 'sweets'), x => x.amount) };
  });
}

export const shortInr = (n: number) => (n >= 1000 ? `₹${Math.round(n / 100) / 10}k` : inr(n));
export const fyLabel = (from: string) => {
  const y = Number(from.slice(0, 4));
  return `Apr ${y} – Mar ${y + 1}`;
};

export type DebtKind = 'invoice' | 'bill' | 'preorder';
// days: age since the event / bill / hand-over; null while not due yet.
export interface Debt { key: string; kind: DebtKind; id: string; name: string; phone: string; line: string; amount: number; days: number | null }

const niceDay = (iso: string) => formatDateIST(iso, 'd MMM');
const daysText = (n: number) => `${n} day${n === 1 ? '' : 's'}`;

// Everyone who owes money today, oldest first.
export function debtsOf(d: MoneyData, today: string): Debt[] {
  const inv = d.invoices.filter(i => Number(i.balance_due) > 0 && live(i)).map((i): Debt => {
    const ev = i.booking?.event_date;
    const days = ev && ev <= today ? daysBetween(ev, today) : null;
    const event = i.booking ? `${i.booking.event_type} on ${niceDay(i.booking.event_date)} · ` : '';
    return { key: i.id, kind: 'invoice', id: i.id, name: i.booking?.customer?.name ?? 'Customer', phone: i.booking?.customer?.phone ?? '', amount: Number(i.balance_due),
      days, line: `${i.invoice_number} · ${event}${inr(i.total_amount)} billed, ${inr(i.advance_paid)} paid${days === null ? ' · not due yet' : ` · ${daysText(days)}`}` };
  });
  const bills = d.orders.filter(o => billDue(o) > 0).map((o): Debt => {
    const day = istDay(o.created_at);
    const items = Array.from(new Set(o.items.map(x => x.item_name))).slice(0, 2).join(', ');
    return { key: o.id, kind: 'bill', id: o.id, name: o.customer_name, phone: o.phone, amount: billDue(o), days: daysBetween(day, today),
      line: `Bill #${billNumber(o.bill_no, o.id)} · ${niceDay(day)}${items ? ` · ${items}` : ''}` };
  });
  const pre = d.preorders.filter(p => bookingDue(p) > 0).map((p): Debt => {
    const day = handedOverOn(p) ?? today;
    return { key: p.id, kind: 'preorder', id: p.id, name: p.customer_name, phone: p.phone, amount: bookingDue(p), days: daysBetween(day, today),
      line: `Pre-booking · handed over ${niceDay(day)} · ${firstItem(p.items)}` };
  });
  return [...inv, ...bills, ...pre].sort((a, b) => (b.days ?? -1) - (a.days ?? -1));
}

export const AGE_LABELS = ['Not due yet', 'Up to 30 days', '31 – 60 days', 'Over 60 days'];
export const ageIndex = (days: number | null) => (days === null ? 0 : days <= 30 ? 1 : days <= 60 ? 2 : 3);
export const ageBuckets = (list: Debt[]) => AGE_LABELS.map((_, i) => sumOf(list.filter(x => ageIndex(x.days) === i), x => x.amount));

// A booking whose sent quote is not accepted yet (a dish still to pick) is still a quote, even if marked confirmed.
export const awaitsAcceptance = (bookingId: string, quotes: QuoteLite[]) => {
  const mine = quotes.filter(q => q.booking_id === bookingId);
  return !mine.some(q => q.status === 'accepted') && mine.some(q => q.status === 'sent');
};

// Money not received yet: confirmed events to invoice, quotes waiting, drafts not sent.
export function comingIn(d: MoneyData, today: string) {
  const todo = invoiceTodo(d.bookings, d.quotes, d.invoices, today);
  const ready = todo.ready.filter(r => !awaitsAcceptance(r.booking.id, d.quotes));
  const byId = new Map(d.bookings.map(b => [b.id, b]));
  const upcoming = (q: QuoteLite) => {
    const b = q.booking_id ? byId.get(q.booking_id) : undefined;
    return b && b.event_date >= today && b.status !== 'cancelled' ? b : undefined;
  };
  const sent = d.quotes.filter(q => q.status === 'sent' && upcoming(q) && awaitsAcceptance(q.booking_id!, d.quotes));
  const drafts = d.quotes.filter(q => q.status === 'draft' && !['confirmed', 'completed'].includes(upcoming(q)?.status ?? 'confirmed'));
  return {
    ready,
    booked: { count: ready.length, value: sumOf(ready, r => r.quote?.total_amount ?? 0) },
    past: { count: todo.past.length, value: todo.pastValue, list: todo.past },
    sent: { count: sent.length, low: sumOf(sent, q => q.total_amount), high: sumOf(sent, q => Math.max(q.total_amount, q.total_max ?? 0)),
      names: sent.map(q => byId.get(q.booking_id!)?.customer?.name ?? 'Customer') },
    drafts: { count: drafts.length, value: sumOf(drafts, q => q.total_amount) },
  };
}

export const rangeText = (low: number, high: number) => (high > low ? `${inr(low)} – ${inr(high)}` : inr(low));
