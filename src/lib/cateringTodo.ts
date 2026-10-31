import { Booking, Invoice } from '../types';

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

// Home "Needs you": what the owner should act on today, most urgent first.
export function needsYou(input: {
  bookings: BookingLite[]; quotes: QuoteLite[]; invoices: InvoiceLite[];
  unpaidBills: { name: string; total: number; at: string }[];
  preorders: { name: string; date: string; total: number; advance: number; open: boolean }[];
  outOfStep: number; today: string;
}): NeedItem[] {
  const { bookings, quotes, invoices, unpaidBills, preorders, today } = input;
  const todo = invoiceTodo(bookings, quotes, invoices, today);
  const byId = new Map(bookings.map(b => [b.id, b]));
  const items: NeedItem[] = todo.owing.map(o => ({
    key: o.invoice.id, tone: 'red', page: 'billing', action: 'Record payment',
    title: `Collect ${inr(o.invoice.balance_due)} from ${nameOf(o.booking)}`,
    line: `${o.invoice.invoice_number} · ${o.booking ? `${o.booking.event_type} on ${nice(o.booking.event_date)} · ` : ''}${o.days} days since the event`,
  }));
  const soon = preorders.filter(p => p.open && p.advance <= 0 && daysBetween(today, p.date) >= 0 && daysBetween(today, p.date) <= 7);
  const days = Array.from(new Set(soon.map(p => p.date))).sort();
  days.forEach(d => {
    const list = soon.filter(p => p.date === d);
    items.push({ key: `pre-${d}`, tone: 'amber', page: 'seasonal_billing', action: 'Ask for advance',
      title: `${list.length} sweets pre-booking${list.length > 1 ? 's' : ''} on ${nice(d)}, no advance yet`,
      line: list.map(p => `${p.name} ${inr(p.total)}`).join(' · ') });
  });
  quotes.filter(q => q.booking_id && byId.get(q.booking_id) && byId.get(q.booking_id)!.event_date >= today).forEach(q => {
    const b = byId.get(q.booking_id!)!;
    if (b.status === 'cancelled' || q.status === 'accepted' || q.status === 'rejected') return;
    if (!['inquiry', 'followup', 'pending'].includes(b.status) && q.status !== 'sent') return;
    const range = q.total_max && q.total_max > q.total_amount ? `${inr(q.total_amount)} – ${inr(q.total_max)}` : inr(q.total_amount);
    if (q.status === 'sent') items.push({ key: q.id, tone: 'purple', page: 'quotations', action: 'Follow up', title: `${nameOf(b)}, ${nice(b.event_date)}: waiting for a reply`, line: `${q.quotation_number} · ${range} · sent` });
    else if (daysBetween(today, b.event_date) <= 45) items.push({ key: q.id, tone: 'amber', page: 'quotations', action: 'Send quote', title: `${nameOf(b)}'s quote is still a draft`, line: `${q.quotation_number} · ${b.event_type} ${nice(b.event_date)}, in ${daysBetween(today, b.event_date)} days · ${range}` });
  });
  unpaidBills.forEach((u, i) => items.push({ key: `bill-${i}`, tone: 'red', page: 'seasonal_billing', action: 'Collect', title: `${u.name} owes ${inr(u.total)} for sweets`, line: `Unpaid since ${nice(u.at.slice(0, 10))}` }));
  if (todo.past.length || input.outOfStep) items.push({ key: 'tidy', tone: 'grey', page: todo.past.length ? 'billing' : 'quotations', action: 'Tidy up',
    title: [todo.past.length && `${todo.past.length} past events have no invoice`, input.outOfStep && `${input.outOfStep} quotes out of step`].filter(Boolean).join(' · '),
    line: 'Settle them so Money and Quotations add up' });
  const rank: Record<Tone, number> = { red: 0, amber: 1, purple: 2, grey: 3 };
  return items.sort((a, b) => rank[a.tone] - rank[b.tone]);
}
