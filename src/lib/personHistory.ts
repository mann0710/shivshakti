import { format } from 'date-fns';
import type { Booking, Invoice } from '../types';
import type { SeasonalOrder } from '../hooks/useSeasonalOrders';
import type { SeasonalPreorder } from '../hooks/useSeasonalPreorders';
import { Person, Side, phoneKey } from './people';
import { billDue, billPaid, bookingDue, isCancelled } from './dues';
import { STATUS_LABEL, balanceOf, istDay } from './preorders';
import { inr } from './money';

// Catering bookings and sweets bills for each person, plus the numbers on their detail panel.

export interface Records { bookings: Booking[]; bills: SeasonalOrder[]; preorders: SeasonalPreorder[] }
export type InvoiceLite = Pick<Invoice, 'booking_id' | 'balance_due' | 'invoice_number'>;
export type Tone = 'green' | 'blue' | 'amber' | 'red' | 'grey';

export interface HistoryItem {
  id: string;
  side: Side;
  kind: 'booking' | 'bill' | 'preorder';
  date: string;
  title: string;
  line: string;
  amount: number;
  status: string;
  tone: Tone;
  live: boolean;
  due: number;
}

export interface Summary {
  sides: Side[];
  catering: number;
  cateringNote: string;
  sweets: number;
  sweetsNote: string;
  owes: number;
  owesNote: string;
  notInvoiced: number;
  notInvoicedNote: string;
  lastSeen: string | null;
  next: HistoryItem | null;
  stale: Booking[];
  line: string;
  history: HistoryItem[];
}

export interface Ctx { invoices: Map<string, InvoiceLite>; worth: (b: Booking) => number; today: string }

const EMPTY: Records = { bookings: [], bills: [], preorders: [] };
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const sum = (list: number[]) => Math.round(list.reduce((s, n) => s + n, 0) * 100) / 100;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// "19 May" this year, "26 Feb 2027" otherwise.
export function dayLabel(iso: string, today: string): string {
  if (!iso) return '';
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return format(d, iso.slice(0, 4) === today.slice(0, 4) ? 'd MMM' : 'd MMM yyyy');
}
export const monthLabel = (iso: string) => format(new Date(`${iso.slice(0, 7)}-01T00:00:00`), 'MMMM yyyy').toUpperCase();

// Bookings by customer id and sweets bills by mobile, filed under each person.
export function recordsByPerson(people: Person[], bookings: Booking[], bills: SeasonalOrder[], preorders: SeasonalPreorder[]): Map<string, Records> {
  const out = new Map<string, Records>(people.map(p => [p.key, { bookings: [], bills: [], preorders: [] }]));
  const byCustomer = new Map<string, string>();
  people.forEach(p => p.catering.forEach(c => byCustomer.set(c.id, p.key)));
  const byPhone = new Set(people.filter(p => phoneKey(p.phone) === p.key).map(p => p.key));
  bookings.forEach(b => { const k = byCustomer.get(b.customer_id); if (k) out.get(k)!.bookings.push(b); });
  bills.forEach(o => { const k = phoneKey(o.phone); if (byPhone.has(k)) out.get(k)!.bills.push(o); });
  preorders.forEach(p => { const k = phoneKey(p.phone); if (byPhone.has(k)) out.get(k)!.preorders.push(p); });
  return out;
}

const isLive = (b: Booking) => b.status !== 'cancelled';
const endOf = (b: Booking) => b.end_date || b.event_date;

function bookingItem(b: Booking, ctx: Ctx): HistoryItem {
  const inv = ctx.invoices.get(b.id);
  const due = Number(inv?.balance_due) || 0;
  const [status, tone]: [string, Tone] = !isLive(b) ? ['Cancelled', 'grey']
    : inv ? (due > 0 ? ['Invoiced', 'amber'] : ['Paid', 'green'])
    : b.status === 'followup' ? ['Follow-up', 'blue']
    : b.status === 'inquiry' ? ['Inquiry', 'blue']
    : b.status === 'pending' ? ['Pending', 'amber'] : [cap(b.status), 'green'];
  const line = ['Catering booking', b.guest_count ? `${b.guest_count} guests` : '', inv ? (due > 0 ? `${inv.invoice_number} · ${inr(due)} due` : inv.invoice_number) : ''];
  return {
    id: b.id, side: 'catering', kind: 'booking', date: b.event_date, live: isLive(b), due: isLive(b) ? Math.max(0, due) : 0,
    title: [b.event_type, b.venue].filter(Boolean).join(' · '), line: line.filter(Boolean).join(' · '),
    amount: ctx.worth(b), status, tone,
  };
}

function billItem(o: SeasonalOrder): HistoryItem {
  const due = billDue(o);
  const paid = billPaid(o);
  const [status, tone]: [string, Tone] = isCancelled(o) ? ['Cancelled', 'grey'] : due > 0 ? (paid > 0 ? ['Part paid', 'amber'] : ['Unpaid', 'red']) : ['Paid', 'green'];
  const money = isCancelled(o) ? 'cancelled' : due <= 0 ? 'paid' : paid > 0 ? `${inr(due)} still due` : 'not paid yet';
  return {
    id: o.id, side: 'sweets', kind: 'bill', date: istDay(o.created_at), live: !isCancelled(o), due,
    title: `Sweets bill${o.bill_no ? ` #${o.bill_no}` : ''}`, line: `${plural(o.items?.length ?? 0, 'item')} · ${money}`,
    amount: Number(o.total_amount) || 0, status, tone,
  };
}

function preorderItem(p: SeasonalPreorder): HistoryItem {
  const cancelled = p.status === 'cancelled';
  const left = p.status === 'delivered' ? bookingDue(p) : balanceOf(p);
  const [status, tone]: [string, Tone] = cancelled ? ['Cancelled', 'grey'] : left > 0 ? (p.status === 'delivered' ? ['Owes', 'red'] : ['Balance due', 'amber']) : ['Paid', 'green'];
  const money = cancelled ? 'cancelled' : left > 0 ? `advance ${inr(Number(p.advance_paid) || 0)}, ${inr(left)} to pay` : 'paid in full';
  return {
    id: p.id, side: 'sweets', kind: 'preorder', date: p.delivery_date || istDay(p.created_at), live: !cancelled, due: bookingDue(p),
    title: `Sweets pre-booking · ${STATUS_LABEL[p.status].toLowerCase()}`, line: `${plural(p.items?.length ?? 0, 'item')} · ${money}`,
    amount: Number(p.total_amount) || 0, status, tone,
  };
}

// Newest first.
export const historyOf = (r: Records, ctx: Ctx): HistoryItem[] =>
  [...r.bookings.map(b => bookingItem(b, ctx)), ...r.bills.map(billItem), ...r.preorders.map(preorderItem)]
    .sort((a, b) => b.date.localeCompare(a.date));

const catNote = (live: Booking[]) => (live.length === 1 ? `1 ${live[0].event_type.toLowerCase()}` : live.length ? plural(live.length, 'event') : 'No bookings');

function listLine(r: Records, live: Booking[], history: HistoryItem[], ctx: Ctx): string {
  const parts: string[] = [];
  const dates = live.map(b => b.event_date).sort();
  const next = dates.find(d => d >= ctx.today);
  if (live.length > 1) parts.push(`${plural(live.length, 'event')} · ${next ? `next ${dayLabel(next, ctx.today)}` : `last ${dayLabel(dates[dates.length - 1], ctx.today)}`}`);
  else if (live.length === 1) parts.push(`${live[0].event_type} ${dayLabel(live[0].event_date, ctx.today)}`);
  const sweet = history.find(h => h.side === 'sweets' && h.live);
  if (sweet) parts.push(`${sweet.kind === 'bill' ? 'Sweets bill' : 'Pre-booking'} ${dayLabel(sweet.date, ctx.today)}`);
  return parts.join(' · ');
}

// Everything the list row and the detail panel show for one person.
export function summarize(p: Person, records: Records | undefined, ctx: Ctx): Summary {
  const r = records ?? EMPTY;
  const live = r.bookings.filter(isLive);
  const history = historyOf(r, ctx);
  const bills = r.bills.filter(o => !isCancelled(o));
  const pre = r.preorders.filter(x => x.status !== 'cancelled');
  const owing = history.filter(h => h.due > 0);
  const uninvoiced = live.filter(b => (b.status === 'confirmed' || b.status === 'completed') && !ctx.invoices.has(b.id))
    .sort((a, b) => a.event_date.localeCompare(b.event_date));
  const past = history.filter(h => h.live && h.date <= ctx.today);
  const upcoming = history.filter(h => h.live && h.date > ctx.today).sort((a, b) => a.date.localeCompare(b.date));
  return {
    sides: [
      ...(p.catering.length || r.bookings.length ? ['catering' as const] : []),
      ...(p.sweets.length || r.bills.length || r.preorders.length ? ['sweets' as const] : []),
    ],
    catering: sum(live.map(ctx.worth)),
    cateringNote: catNote(live),
    sweets: sum([...bills.map(o => Number(o.total_amount) || 0), ...pre.map(x => Number(x.total_amount) || 0)]),
    sweetsNote: [bills.length ? plural(bills.length, 'bill') : '', pre.length ? plural(pre.length, 'pre-booking') : ''].filter(Boolean).join(' · ') || 'No sweets yet',
    owes: sum(owing.map(h => h.due)),
    owesNote: owing.length === 1 ? owing[0].title : `${owing.length} unpaid`,
    notInvoiced: sum(uninvoiced.map(ctx.worth)),
    notInvoicedNote: uninvoiced.length ? `${uninvoiced[0].event_type} ${dayLabel(uninvoiced[0].event_date, ctx.today)}${uninvoiced.length > 1 ? ` +${uninvoiced.length - 1}` : ''}` : live.some(b => b.status === 'confirmed' || b.status === 'completed') ? 'All invoiced' : live.length ? 'Nothing confirmed yet' : 'Nothing to invoice',
    lastSeen: past[0]?.date ?? null,
    next: upcoming[0] ?? null,
    stale: live.filter(b => b.status === 'confirmed' && endOf(b) < ctx.today),
    line: listLine(r, live, history, ctx),
    history,
  };
}

export type Filter = 'all' | 'catering' | 'sweets' | 'owes';
export const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'catering', label: 'Catering' }, { id: 'sweets', label: 'Sweets' }, { id: 'owes', label: 'Owes money' },
];

export const matchesFilter = (s: Pick<Summary, 'sides' | 'owes'>, f: Filter) =>
  f === 'all' || (f === 'owes' ? s.owes > 0 : s.sides.includes(f));

export const filterCounts = (list: Pick<Summary, 'sides' | 'owes'>[]): Record<Filter, number> => ({
  all: list.length,
  catering: list.filter(s => matchesFilter(s, 'catering')).length,
  sweets: list.filter(s => matchesFilter(s, 'sweets')).length,
  owes: list.filter(s => matchesFilter(s, 'owes')).length,
});

// Months, newest first, each with its items.
export function byMonth(items: HistoryItem[]): { month: string; items: HistoryItem[] }[] {
  const out: { month: string; items: HistoryItem[] }[] = [];
  items.forEach(i => {
    const m = monthLabel(i.date);
    if (out[out.length - 1]?.month !== m) out.push({ month: m, items: [] });
    out[out.length - 1].items.push(i);
  });
  return out;
}
