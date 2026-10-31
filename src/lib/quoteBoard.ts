import type { Quotation } from '../hooks/useQuotations';
import type { Booking } from '../types';
import { inr } from './money';
import { formatDateIST } from './ist';
import { groupQuotes, acceptedOf, QuoteGroup } from './quoteGroups';
import { quoteDays, optionTitle, plateText, quoteGuests } from './quoteOptions';
import { choiceGroups, pickedOf, dishCount } from './quoteChoices';

// The Quotations list: follow-ups first, then drafts, accepted and lost.
export type QuoteTab = 'todo' | 'accepted' | 'lost' | 'all';
export type Section = 'waiting' | 'drafts' | 'accepted' | 'lost';
export type NextKind = 'pick' | 'option' | 'accept' | 'send' | 'invoice';

export const QUOTE_TABS: { id: QuoteTab; label: string; short: string }[] = [
  { id: 'todo', label: 'To do', short: 'To do' },
  { id: 'accepted', label: 'Accepted', short: 'Accepted' },
  { id: 'lost', label: 'Declined & expired', short: 'Lost' },
  { id: 'all', label: 'All', short: 'All' },
];
export const SECTION_TITLES: Record<Section, string> = {
  waiting: 'Waiting for the customer', drafts: 'Drafts to send · soonest event first', accepted: 'Accepted', lost: 'Declined & expired',
};
const IN_TAB: Record<QuoteTab, Section[]> = { todo: ['waiting', 'drafts'], accepted: ['accepted'], lost: ['lost'], all: ['waiting', 'drafts', 'accepted', 'lost'] };

export interface BoardRow {
  key: string;
  group: QuoteGroup;
  head: Quotation;
  section: Section;
  date: string;
  name: string;
  line: string;
  flag: string;
  flagTone: 'warn' | 'bad' | '';
  next: { kind: NextKind; label: string } | null;
}

const DAY = 86400000;
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Open "choose any" groups across every meal, with how many the customer picks.
export const openPicks = (q: Pick<Quotation, 'is_multi_day' | 'event_days' | 'items'>) => {
  const lists = q.is_multi_day && q.event_days?.length ? q.event_days.flatMap(d => d.meals.map(m => m.items ?? [])) : [q.items ?? []];
  return lists.flatMap(l => choiceGroups(l).filter(g => !pickedOf(g).length))
    .map(g => ({ label: g.meta.label, pick: Math.min(Math.max(1, g.meta.pick), g.items.length) }));
};

// "has to pick 1 farsan"
export const pickText = (q: Quotation) => {
  const p = openPicks(q);
  if (!p.length) return '';
  return p.length === 1 ? `has to pick ${p[0].pick} ${p[0].label.toLowerCase()}` : `has to pick ${p.length} choices`;
};

export const sectionOf = (g: QuoteGroup): Section =>
  acceptedOf(g) ? 'accepted' : g.options.every(o => o.status === 'rejected') ? 'lost'
    : g.options.some(o => o.status === 'sent') ? 'waiting' : 'drafts';

export const lostWhy = (g: QuoteGroup, today: string): 'declined' | 'expired' => {
  const head = g.options[0];
  if (head.booking?.status === 'cancelled') return 'declined';
  const day = quoteDays(head)[0];
  return day && day < today ? 'expired' : 'declined';
};

// Red note on a draft: the event has passed, is close, or has no guest count.
const draftFlag = (q: Quotation, date: string, today: string) => {
  const n = date ? daysBetween(today, date) : null;
  if (n != null && n < 0) return 'event has passed';
  if (n != null && n <= 30) return n === 0 ? 'event today' : n === 1 ? 'event tomorrow' : `event in ${n} days`;
  return !q.is_multi_day && !quoteGuests(q) ? 'guest count missing' : '';
};

const nextOf = (g: QuoteGroup, section: Section, invoiced: boolean): BoardRow['next'] => {
  if (section === 'drafts') return { kind: 'send', label: 'Send' };
  if (section === 'accepted') return invoiced ? null : { kind: 'invoice', label: 'Create invoice' };
  if (section !== 'waiting') return null;
  if (g.grouped) return { kind: 'option', label: 'Accept an option' };
  const p = openPicks(g.options[0]);
  if (p.length) return { kind: 'pick', label: p.length === 1 ? `Pick ${p[0].label.toLowerCase()} & accept` : 'Pick dishes & accept' };
  return { kind: 'accept', label: 'Mark accepted' };
};

export function boardRow(g: QuoteGroup, today: string, invoiced: Set<string>): BoardRow {
  const won = acceptedOf(g);
  const head = won ?? g.options[0];
  const section = sectionOf(g);
  const date = quoteDays(head)[0] ?? '';
  const guests = quoteGuests(head);
  const status = section === 'waiting' ? (g.grouped ? `${g.options.length} options sent together` : 'sent')
    : section === 'drafts' ? `${g.grouped ? `${g.options.length} options · ` : ''}draft since ${formatDateIST(head.created_at, 'd MMM')}`
      : section === 'accepted' ? (won && g.grouped ? `${optionTitle(won)} chosen` : 'accepted')
        : lostWhy(g, today);
  let flag = '';
  let flagTone: BoardRow['flagTone'] = '';
  if (section === 'drafts') { flag = draftFlag(head, date, today); flagTone = flag ? 'bad' : ''; }
  if (section === 'waiting') { flag = g.grouped ? 'picks one option' : pickText(head); flagTone = flag ? 'warn' : ''; }
  return {
    key: g.key, group: g, head, section, date,
    name: [head.customer?.name || 'Customer', head.booking?.event_type].filter(Boolean).join(' · '),
    line: [head.quotation_number, guests > 0 ? `${guests} guests` : '', status].filter(Boolean).join(' · '),
    flag, flagTone,
    next: nextOf(g, section, !!head.booking_id && invoiced.has(head.booking_id)),
  };
}

// Upcoming soonest first, then undated, then past (latest first); lost newest first.
const rank = (r: BoardRow, today: string) => (!r.date ? 1 : r.date >= today ? 0 : 2);
const order = (today: string) => (a: BoardRow, b: BoardRow) => {
  if (a.section === 'lost') return b.date.localeCompare(a.date);
  const ra = rank(a, today);
  return ra - rank(b, today) || (ra === 2 ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date));
};

export function buildBoard(quotes: Quotation[], today: string, invoiced: Set<string> = new Set()): BoardRow[] {
  return groupQuotes(quotes).map(g => boardRow(g, today, invoiced)).sort(order(today));
}

// Names, phone digits, QTN numbers, event type and option names.
export function matchesSearch(r: BoardRow, term: string): boolean {
  const t = term.trim().toLowerCase();
  if (!t) return true;
  const digits = t.replace(/\D/g, '');
  return r.group.options.some(q => [q.quotation_number, q.customer?.name, q.booking?.event_type, q.option_name].join(' ').toLowerCase().includes(t)
    || (digits.length >= 3 && String(q.customer?.phone || '').replace(/\D/g, '').includes(digits)));
}

export const boardSections = (rows: BoardRow[], tab: QuoteTab) =>
  IN_TAB[tab].map(id => ({ id, title: SECTION_TITLES[id], rows: rows.filter(r => r.section === id) })).filter(s => s.rows.length);

export const tabCounts = (rows: BoardRow[]) =>
  Object.fromEntries(QUOTE_TABS.map(t => [t.id, rows.filter(r => IN_TAB[t.id].includes(r.section)).length])) as Record<QuoteTab, number>;

// "1 waiting for the customer · 5 drafts to send"
export function headline(rows: BoardRow[]): string {
  const w = rows.filter(r => r.section === 'waiting').length;
  const d = rows.filter(r => r.section === 'drafts').length;
  const parts = [w ? `${w} waiting for the customer` : '', d ? `${d} draft${d > 1 ? 's' : ''} to send` : ''].filter(Boolean);
  return parts.length ? parts.join(' · ') : rows.length ? 'Nothing waiting — all quotes sent' : '';
}

// Lowest and highest total across the options (or the one quote's range).
export const groupRange = (g: QuoteGroup) => {
  const list = acceptedOf(g) ? [acceptedOf(g)!] : g.options;
  return { lo: Math.min(...list.map(o => o.total_amount || 0)), hi: Math.max(...list.map(o => Math.max(o.total_max ?? 0, o.total_amount || 0))) };
};

// Phone price: "₹28,800+" or "₹4.9 – 7.25 L".
export function shortPrice(g: QuoteGroup): string {
  const { lo, hi } = groupRange(g);
  if (hi <= lo) return inr(lo);
  const lakh = (n: number) => String(+(n / 100000).toFixed(2));
  return g.grouped && lo >= 100000 ? `₹${lakh(lo)} – ${lakh(hi)} L` : `${inr(lo)}+`;
}

// "₹1,450 a plate · 11 dishes" or "2 days · 4 meals".
export function optionLine(q: Quotation): string {
  if (q.is_multi_day) {
    const meals = (q.event_days ?? []).reduce((s, d) => s + d.meals.length, 0);
    return `${quoteDays(q).length || 1} day${quoteDays(q).length > 1 ? 's' : ''} · ${meals} meal${meals === 1 ? '' : 's'}`;
  }
  const n = dishCount(q.items);
  return [q.per_plate_amount > 0 ? `${plateText(q)} a plate` : '', `${n} dish${n === 1 ? '' : 'es'}`].filter(Boolean).join(' · ');
}

// Bookings that could use a quote: upcoming, not closed, nothing sent or accepted yet.
export function bookingsToQuote(bookings: Booking[], quotes: Quotation[], today: string) {
  return bookings
    .filter(b => !['cancelled', 'completed'].includes(b.status) && (b.end_date || b.event_date) >= today
      && !quotes.some(q => q.booking_id === b.id && (q.status === 'sent' || q.status === 'accepted')))
    .sort((a, b) => a.event_date.localeCompare(b.event_date))
    .map(b => ({ booking: b, draft: quotes.find(q => q.booking_id === b.id && q.status === 'draft') }));
}

export interface HistoryLine { when: string; what: string }

// What we know happened to a quote, oldest first.
export function quoteHistory(r: BoardRow, today: string): HistoryLine[] {
  const g = r.group;
  const head = r.head;
  const b: Booking | undefined = head.booking;
  const picks = openPicks(g.options[0]);
  const made = g.grouped ? ` with ${g.options.length} options` : picks.length ? ` with a ${picks[0].label.toLowerCase()} choice` : '';
  const out: HistoryLine[] = [{ when: formatDateIST(g.options[0].created_at, 'd MMM'), what: `Created${made}` }];
  if (r.section === 'waiting' || r.section === 'accepted') out.push({ when: '', what: `Sent${head.customer?.phone ? ' on WhatsApp' : ''} to ${head.customer?.name || 'the customer'}` });
  if (r.section === 'accepted') {
    const won = acceptedOf(g)!;
    out.push({ when: b?.advance_date ? formatDateIST(b.advance_date, 'd MMM') : '', what: `Accepted${g.grouped ? ` · ${optionTitle(won)}` : ''}` });
    const mode = b?.advance_mode === 'upi' ? 'UPI' : b?.advance_mode ? cap(b.advance_mode) : '';
    if (Number(b?.advance_received) > 0) out.push({ when: '', what: `Advance ${inr(Number(b!.advance_received))}${mode ? ` by ${mode}` : ''} — goes on the invoice` });
  }
  if (r.section === 'waiting' && r.date >= today) out.push({ when: '', what: 'No reply yet — a reminder is on Home' });
  if (r.section === 'lost') out.push({ when: '', what: cap(lostWhy(g, today)) });
  return out;
}
