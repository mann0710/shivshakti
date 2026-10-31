import { Booking, Invoice } from '../types';
import { DEFAULT_DOC_SETTINGS, DocSettings } from './docs/settings';

type QuoteLite = { id: string; booking_id?: string | null; status: string; quotation_number: string; total_amount: number; total_max?: number | null; created_at: string };
type BookingLite = Pick<Booking, 'id' | 'status' | 'event_date' | 'event_type' | 'guest_count'> & { customer?: { name?: string } | null };
type InvoiceLite = Pick<Invoice, 'id' | 'booking_id' | 'invoice_number' | 'total_amount' | 'balance_due' | 'status'>;

export const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86400000);
const nameOf = (b?: BookingLite) => b?.customer?.name?.trim() || 'Customer';

export interface Ready { booking: BookingLite; quote?: QuoteLite }
export interface Owing { invoice: InvoiceLite; booking?: BookingLite; days: number }

// Invoices page groups: money still due, confirmed events ready to invoice, finished events never invoiced.
export function invoiceTodo(bookings: BookingLite[], quotes: QuoteLite[], invoices: InvoiceLite[], today: string) {
  const invoiced = new Set(invoices.map(i => i.booking_id));
  const byId = new Map(bookings.map(b => [b.id, b]));
  const quoteFor = (id: string) => quotes.find(q => q.booking_id === id && q.status === 'accepted') ?? quotes.find(q => q.booking_id === id && q.status !== 'rejected');
  const owing: Owing[] = invoices.filter(i => i.balance_due > 0)
    .map(i => ({ invoice: i, booking: byId.get(i.booking_id), days: Math.max(0, daysBetween(byId.get(i.booking_id)?.event_date ?? today, today)) }))
    .sort((a, b) => b.days - a.days);
  const done = bookings.filter(b => ['confirmed', 'completed'].includes(b.status) && !invoiced.has(b.id));
  const ready: Ready[] = done.filter(b => b.event_date >= today).map(b => ({ booking: b, quote: quoteFor(b.id) }));
  const past: Ready[] = done.filter(b => b.event_date < today).map(b => ({ booking: b, quote: quoteFor(b.id) }));
  return { owing, ready, past, pastValue: past.reduce((s, r) => s + (r.quote?.total_amount ?? 0), 0) };
}

export type Tone = 'red' | 'amber' | 'purple' | 'grey';
export interface NeedItem { key: string; tone: Tone; title: string; line: string; page: 'billing' | 'quotations' | 'bookings' | 'seasonal_billing'; action: string }

const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const nice = (iso: string) => { const [, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1]}`; };

type Pre = { name: string; date: string; total: number; advance: number; open: boolean };

// Open pre-bookings grouped by their day, soonest first.
function byDay(list: Pre[], push: (day: string, list: Pre[]) => void) {
  Array.from(new Set(list.map(p => p.date))).sort().forEach(d => push(d, list.filter(p => p.date === d)));
}

const eventWhen = (b: BookingLite, today: string, days: number) => {
  const ahead = daysBetween(today, b.event_date);
  return ahead > 0 ? `event in ${ahead} day${ahead === 1 ? '' : 's'}` : ahead === 0 ? 'event today' : `${days} days since the event`;
};

// Home "Needs you": what the owner should act on today, most urgent first; Settings › Reminders on Home decide when each shows.
export function needsYou(input: {
  bookings: BookingLite[]; quotes: QuoteLite[]; invoices: InvoiceLite[];
  unpaidBills: { name: string; total: number; at: string }[];
  preorders: Pre[];
  outOfStep: number; today: string;
  reminders?: DocSettings['reminders'];
}): NeedItem[] {
  const { bookings, quotes, invoices, unpaidBills, preorders, today } = input;
  const r = input.reminders ?? DEFAULT_DOC_SETTINGS.reminders;
  const todo = invoiceTodo(bookings, quotes, invoices, today);
  const byId = new Map(bookings.map(b => [b.id, b]));
  // Money due shows from `days` before the event.
  const items: NeedItem[] = todo.owing.filter(o => r.pay_due.on && (!o.booking || daysBetween(today, o.booking.event_date) <= r.pay_due.days)).map(o => ({
    key: o.invoice.id, tone: 'red', page: 'billing', action: 'Record payment',
    title: `Collect ${inr(o.invoice.balance_due)} from ${nameOf(o.booking)}`,
    line: `${o.invoice.invoice_number} · ${o.booking ? `${o.booking.event_type} on ${nice(o.booking.event_date)} · ${eventWhen(o.booking, today, o.days)}` : `${o.days} days since the event`}`,
  }));
  const ahead = (p: Pre) => daysBetween(today, p.date);
  byDay(preorders.filter(p => p.open && p.advance <= 0 && ahead(p) >= 0 && ahead(p) <= 7), (d, list) => items.push({
    key: `pre-${d}`, tone: 'amber', page: 'seasonal_billing', action: 'Ask for advance',
    title: `${list.length} sweets pre-booking${list.length > 1 ? 's' : ''} on ${nice(d)}, no advance yet`,
    line: list.map(p => `${p.name} ${inr(p.total)}`).join(' · '),
  }));
  if (r.pickup.on) byDay(preorders.filter(p => p.open && p.advance > 0 && ahead(p) >= 0 && ahead(p) <= r.pickup.days), (d, list) => items.push({
    key: `pick-${d}`, tone: 'purple', page: 'seasonal_billing', action: 'Remind',
    title: `${list.length} pre-booking${list.length > 1 ? 's' : ''} to hand over ${d === today ? 'today' : `on ${nice(d)}`}`,
    line: list.map(p => `${p.name} ${inr(p.total - p.advance)} to collect`).join(' · '),
  }));
  quotes.filter(q => q.booking_id && byId.get(q.booking_id) && byId.get(q.booking_id)!.event_date >= today).forEach(q => {
    const b = byId.get(q.booking_id!)!;
    if (b.status === 'cancelled' || q.status === 'accepted' || q.status === 'rejected') return;
    if (!['inquiry', 'followup', 'pending'].includes(b.status) && q.status !== 'sent') return;
    const range = q.total_max && q.total_max > q.total_amount ? `${inr(q.total_amount)} – ${inr(q.total_max)}` : inr(q.total_amount);
    if (q.status === 'sent' && !(r.quote_reply.on && daysBetween(q.created_at.slice(0, 10), today) >= r.quote_reply.days)) return;
    if (q.status === 'sent') items.push({ key: q.id, tone: 'purple', page: 'quotations', action: 'Follow up', title: `${nameOf(b)}, ${nice(b.event_date)}: waiting for a reply`, line: `${q.quotation_number} · ${range} · sent` });
    else if (daysBetween(today, b.event_date) <= 45) items.push({ key: q.id, tone: 'amber', page: 'quotations', action: 'Send quote', title: `${nameOf(b)}'s quote is still a draft`, line: `${q.quotation_number} · ${b.event_type} ${nice(b.event_date)}, in ${daysBetween(today, b.event_date)} days · ${range}` });
  });
  unpaidBills.forEach((u, i) => r.sweets_unpaid.on && daysBetween(u.at.slice(0, 10), today) >= r.sweets_unpaid.days && items.push({ key: `bill-${i}`, tone: 'red', page: 'seasonal_billing', action: 'Collect', title: `${u.name} owes ${inr(u.total)} for sweets`, line: `Unpaid since ${nice(u.at.slice(0, 10))}` }));
  // One tidy-up row per screen that fixes it.
  const n = todo.past.length, odd = input.outOfStep;
  if (n) items.push({ key: 'tidy', tone: 'grey', page: 'billing', action: 'Tidy up', title: `${n} past event${n === 1 ? ' has' : 's have'} no invoice`, line: 'Invoice or settle them so Money adds up' });
  if (odd) items.push({ key: 'tidy-quotes', tone: 'grey', page: 'quotations', action: 'Tidy up', title: `${odd} quote${odd === 1 ? '' : 's'} out of step`, line: 'Settle them so Quotations add up' });
  const rank: Record<Tone, number> = { red: 0, amber: 1, purple: 2, grey: 3 };
  return items.sort((a, b) => rank[a.tone] - rank[b.tone]);
}
