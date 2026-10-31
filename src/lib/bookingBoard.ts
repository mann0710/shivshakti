import type { Booking, Invoice } from '../types';
import type { Quotation } from '../hooks/useQuotations';
import { eventStage, Stage } from './eventStage';
import { pendingChoice, openChoiceLabels } from './quoteChoices';
import { siblingsOf, totalText } from './quoteOptions';
import { pickQuotation } from './quoteMath';
import { formatDateIST } from './ist';
import { inr } from './money';

// The Bookings screen's brain: which tab a booking sits in, its one next step, month groups and pipeline columns.
export type Tab = 'upcoming' | 'attention' | 'past' | 'cancelled';
export const TABS: { id: Tab; label: string }[] = [
  { id: 'upcoming', label: 'Upcoming' }, { id: 'attention', label: 'Needs attention' },
  { id: 'past', label: 'Past' }, { id: 'cancelled', label: 'Lost or cancelled' },
];

export type NextKind = 'quote' | 'pick' | 'accept' | 'invoice' | 'payment' | 'complete' | 'close';
export interface Next { kind: NextKind; label: string }

export interface BookingView {
  b: Booking;
  stage: Stage;
  tab: Tab;
  next: Next | null;
  quote?: Quotation;     // the quote a pick / accept acts on, else the booking's chosen one
  invoice?: Invoice;
  value: number;
  valueText: string;
  start: string;
  end: string;
}

export const STAGE_STYLE: Record<Stage, { bg: string; fg: string; dot: string }> = {
  inquiry: { bg: '#E6F1FB', fg: '#185FA5', dot: '#3B7FC4' },
  quoted: { bg: '#EEEDFE', fg: '#4A41A8', dot: '#6B62CF' },
  confirmed: { bg: '#EAF3DE', fg: '#2F5A0E', dot: '#4F8A1E' },
  invoiced: { bg: '#FAEEDA', fg: '#7A4A0A', dot: '#C98A1E' },
  paid: { bg: '#E1F5EE', fg: '#0F6E56', dot: '#16967A' },
  cancelled: { bg: '#FCEBEB', fg: '#A32D2D', dot: '#C04545' },
};

const pickLabel = (q: Quotation, siblings: number) => {
  if (pendingChoice(q, siblings) === 'option') return 'Pick option & accept';
  const labels = openChoiceLabels(q);
  return labels.length === 1 ? `Pick ${labels[0].toLowerCase()} & accept` : 'Pick dishes & accept';
};

// One next step per booking; past events ask to be closed so totals stay right.
function nextStep(b: Booking, stage: Stage, past: boolean, invoice: Invoice | undefined, toPick: Quotation | undefined, siblings: number, drafted = false): Next | null {
  if (stage === 'cancelled') return null;
  if (invoice) {
    if (Number(invoice.balance_due) > 0) return { kind: 'payment', label: 'Record payment' };
    return past && b.status !== 'completed' ? { kind: 'complete', label: 'Mark completed' } : null;
  }
  if (b.status === 'completed') return null;
  if (toPick) return { kind: 'pick', label: pickLabel(toPick, siblings) };
  if (stage === 'inquiry') return past ? { kind: 'close', label: 'Close as lost' } : { kind: 'quote', label: drafted ? 'Send quote' : 'Make quotation' };
  if (stage === 'quoted') return past ? { kind: 'close', label: 'Close as lost' } : { kind: 'accept', label: 'Mark accepted' };
  if (stage === 'confirmed') return past ? { kind: 'complete', label: 'Mark completed' } : { kind: 'invoice', label: 'Create invoice' };
  return null;
}

export function bookingView(b: Booking, ctx: { quotes: Quotation[]; invoices: Invoice[]; value: number; today: string }): BookingView {
  const quotes = ctx.quotes.filter(q => q.booking_id === b.id);
  const invoice = ctx.invoices.find(i => i.booking_id === b.id);
  const stage = eventStage(b, quotes, invoice);
  const start = b.event_date;
  const end = b.end_date && b.end_date > start ? b.end_date : start;
  const past = end < ctx.today;
  const sibs = (q: Quotation) => siblingsOf(q, ctx.quotes).length;
  // Only a sent quote can be picked from or accepted; an unsent draft waits to be sent.
  const toPick = quotes.find(q => q.status === 'sent' && pendingChoice(q, sibs(q)));
  const next = nextStep(b, stage, past, invoice, toPick, toPick ? sibs(toPick) : 1, quotes.some(q => q.status === 'draft'));
  const quote = toPick ?? (next?.kind === 'accept' ? quotes.find(q => q.status === 'sent') : undefined) ?? pickQuotation(ctx.quotes, b.id);
  const tab: Tab = stage === 'cancelled' ? 'cancelled' : past && next ? 'attention' : past ? 'past' : 'upcoming';
  const valueText = invoice ? inr(ctx.value) : quote && quote.status !== 'rejected' ? totalText(quote) : ctx.value > 0 ? inr(ctx.value) : 'No quote yet';
  return { b, stage, tab, next, quote, invoice, value: ctx.value, valueText, start, end };
}

// Upcoming and attention read forwards in time; past and cancelled newest first.
export const sortForTab = (views: BookingView[], tab: Tab) =>
  [...views].sort((x, y) => (tab === 'upcoming' || tab === 'attention' ? x.start.localeCompare(y.start) : y.start.localeCompare(x.start)));

export interface MonthGroup { key: string; title: string; views: BookingView[]; guests: number }
export function groupByMonth(views: BookingView[]): MonthGroup[] {
  const out: MonthGroup[] = [];
  for (const v of views) {
    const key = v.start.slice(0, 7);
    let g = out.find(x => x.key === key);
    if (!g) { g = { key, title: formatDateIST(v.start, 'MMMM yyyy'), views: [], guests: 0 }; out.push(g); }
    g.views.push(v);
    g.guests += Number(v.b.guest_count) || 0;
  }
  return out;
}

// Summary tiles over the upcoming events and every open next step.
export function boardStats(views: BookingView[]) {
  const upcoming = sortForTab(views.filter(v => v.tab === 'upcoming'), 'upcoming');
  const waiting = views.filter(v => (v.tab === 'upcoming' || v.tab === 'attention') && v.next);
  const count = (kinds: NextKind[]) => waiting.filter(v => kinds.includes(v.next!.kind)).length;
  const parts = [[count(['invoice']), 'invoice'], [count(['quote']), 'quote'], [count(['pick', 'accept']), 'decision'],
    [count(['payment']), 'payment'], [count(['complete', 'close']), 'to close']] as [number, string][];
  return {
    upcoming: upcoming.length,
    nextUp: upcoming[0],
    confirmedValue: upcoming.filter(v => v.stage !== 'inquiry' && v.stage !== 'quoted').reduce((s, v) => s + v.value, 0),
    confirmedCount: upcoming.filter(v => v.stage !== 'inquiry' && v.stage !== 'quoted').length,
    waiting: waiting.length,
    waitingNote: parts.filter(([n]) => n > 0).map(([n, w]) => `${n} ${w}${n > 1 && w !== 'to close' ? 's' : ''}`).join(' · '),
  };
}

// Pipeline: open work plus what was paid in the last 90 days.
export const PIPELINE: Stage[] = ['inquiry', 'quoted', 'confirmed', 'invoiced', 'paid'];
export const PAID_DAYS = 90;
export function pipelineColumns(views: BookingView[], today: string) {
  const since = new Date(`${today}T00:00:00Z`);
  since.setUTCDate(since.getUTCDate() - PAID_DAYS);
  const cutoff = since.toISOString().slice(0, 10);
  const live = views.filter(v => v.tab === 'upcoming' || v.tab === 'attention' || (v.stage === 'paid' && v.end >= cutoff));
  return PIPELINE.map(stage => {
    const cards = sortForTab(live.filter(v => v.stage === stage), stage === 'paid' ? 'past' : 'upcoming');
    const total = cards.reduce((s, v) => s + v.value, 0);
    const due = cards.reduce((s, v) => s + (Number(v.invoice?.balance_due) || 0), 0);
    const note = stage === 'paid' ? `Last ${PAID_DAYS} days` : stage === 'invoiced' ? (due ? `${inr(due)} due` : '') : total ? inr(total) : '';
    return { stage, cards, total, note };
  });
}

// Finished events with an accepted quote but no invoice: money that was never billed.
export const neverInvoiced = (views: BookingView[]) => views.filter(v => (v.tab === 'past' || v.tab === 'attention') && v.stage === 'confirmed');

// Festival markers for the calendar: each occasion on its last (main) day.
export function festivalDays(occasions: { name: string; end_date?: string | null }[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  occasions.forEach(o => { if (o.end_date) out.set(o.end_date, [...(out.get(o.end_date) ?? []), o.name]); });
  return out;
}

// Every booking touching a date (multi-day events cover each day).
export const onDay = (views: BookingView[], iso: string) => views.filter(v => v.stage !== 'cancelled' && v.start <= iso && v.end >= iso);

export const dateRangeText = (b: Pick<Booking, 'event_date' | 'end_date'>) => {
  const from = formatDateIST(b.event_date, 'dd-MM-yyyy');
  return b.end_date && b.end_date !== b.event_date ? `${from} → ${formatDateIST(b.end_date, 'dd-MM-yyyy')}` : from;
};
