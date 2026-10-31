import { NeedItem, Tone, daysBetween } from './cateringTodo';
import { choiceGroups, pickedOf } from './quoteChoices';
import type { Quotation } from '../hooks/useQuotations';
import { addDays } from './reports/model';
import { inr } from './money';
import { formatDateIST } from './ist';

// Home: "Needs you" with two actions per row, the four tiles, next events and sweets this week.

export type NeedKind = 'invoice' | 'preorders' | 'pickup' | 'quote' | 'bill' | 'tidy';
export interface HomeNeed extends NeedItem { kind: NeedKind; ref: string; first: string; firstShort: string; second: string; secondShort: string }
export interface OpenChoice { label: string; options: string[] }

// Choice groups the customer has not decided yet, with their dishes.
export const openChoicesOf = (q: Pick<Quotation, 'is_multi_day' | 'event_days' | 'items'>): OpenChoice[] => {
  const lists = q.is_multi_day && q.event_days?.length ? q.event_days.flatMap(d => d.meals.map(m => m.items ?? [])) : [q.items ?? []];
  return lists.flatMap(l => choiceGroups(l).filter(g => !pickedOf(g).length).map(g => ({ label: g.meta.label, options: g.items.map(i => i.item_name) })));
};

const isTidy = (i: NeedItem) => i.key.startsWith('tidy');
const kindOf = (i: NeedItem): NeedKind =>
  isTidy(i) ? 'tidy' : i.key.startsWith('pre-') ? 'preorders' : i.key.startsWith('pick-') ? 'pickup' : i.key.startsWith('bill-') ? 'bill' : i.page === 'billing' ? 'invoice' : 'quote';

const ACTIONS: Record<Exclude<NeedKind, 'quote'>, [string, string, string, string]> = {
  invoice: ['Record payment', 'Record payment', 'WhatsApp reminder', 'WhatsApp'],
  preorders: ['Ask for advance', 'Ask for advance', 'Open', 'Open'],
  pickup: ['Send pickup reminder', 'Remind', 'Open', 'Open'],
  bill: ['Record payment', 'Record payment', 'WhatsApp', 'WhatsApp'],
  tidy: ['Tidy up', 'Tidy up', 'Later', 'Later'],
};
const RANK: Record<Tone, number> = { red: 0, amber: 1, purple: 2, grey: 3 };

// Adds the two buttons per row; a quote waiting on a pick asks "which farsan?".
export function homeNeeds(base: NeedItem[], ctx: {
  choices: (quoteId: string) => OpenChoice[];
  bills: { no: string; day: string; paid: number }[];
  hideTidy?: boolean;
}): HomeNeed[] {
  const short = (t: string) => t.replace(/\bSept\b/g, 'Sep');
  return base.filter(i => !(ctx.hideTidy && isTidy(i))).map(x => ({ ...x, title: short(x.title), line: short(x.line) })).map((i): HomeNeed => {
    const kind = kindOf(i);
    const ref = kind === 'preorders' ? i.key.slice(4) : kind === 'bill' || kind === 'pickup' ? i.key.slice(5) : i.key;
    if (kind === 'bill') {
      const b = ctx.bills[Number(ref)];
      const [first, firstShort, second, secondShort] = ACTIONS.bill;
      return { ...i, kind, ref, first, firstShort, second, secondShort, line: b ? `Bill #${b.no} · ${niceDay(b.day)} · ${b.paid > 0 ? `${inr(b.paid)} paid` : 'not paid'}` : i.line };
    }
    if (kind !== 'quote') {
      const [first, firstShort, second, secondShort] = ACTIONS[kind];
      return { ...i, kind, ref, first, firstShort, second, secondShort };
    }
    const open = ctx.choices(i.key);
    if (open.length) {
      const what = open[0].label.toLowerCase();
      const parts = i.line.split(' · ');
      return { ...i, kind, ref, tone: 'amber', title: `${i.title.split(':')[0].replace(/'s quote is still a draft$/, '')}: which ${what}?`,
        line: [parts[0], open[0].options.join(' or '), parts.find(p => p.startsWith('₹'))].filter(Boolean).join(' · '),
        first: `Pick ${what} & accept`, firstShort: `Pick ${what}`, second: 'WhatsApp', secondShort: 'WhatsApp' };
    }
    const sent = i.action === 'Follow up';
    return { ...i, kind, ref, tone: 'purple',
      first: sent ? 'Follow up on WhatsApp' : 'Send on WhatsApp', firstShort: sent ? 'Follow up' : 'Send', second: 'Open', secondShort: 'Open' };
  }).sort((a, b) => RANK[a.tone] - RANK[b.tone]);
}

export const niceDay = (iso: string) => formatDateIST(iso.slice(0, 10), 'd MMM');
export const weekDay = (iso: string) => formatDateIST(iso, 'EEE d MMM');

// "11:30" -> "11:30 AM"
export function clock(t?: string | null): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(t ?? '');
  if (!m) return '';
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
}

interface EventLike { id: string; event_date: string; status: string; guest_count: number; customer?: { name?: string } | null }

// Next-30-days tile: how many events, guests and on which days.
export function nextDays<E extends EventLike>(bookings: E[], today: string, days = 30) {
  const end = addDays(today, days);
  const list = bookings.filter(b => b.status !== 'cancelled' && b.event_date >= today && b.event_date <= end).sort((a, b) => a.event_date.localeCompare(b.event_date));
  const dates = Array.from(new Set(list.map(b => b.event_date)));
  const daysText = dates.length > 2 ? `${niceDay(dates[0])} to ${niceDay(dates[dates.length - 1])}` : sameMonthJoin(dates);
  return { count: list.length, guests: list.reduce((s, b) => s + (b.guest_count || 0), 0), daysText, first: list[0] };
}

// "25 and 26 Nov", "30 Nov and 2 Dec"
function sameMonthJoin(dates: string[]): string {
  if (dates.length < 2) return dates.map(niceDay).join('');
  const [a, b] = dates;
  return a.slice(0, 7) === b.slice(0, 7) ? `${Number(a.slice(8))} and ${niceDay(b)}` : `${niceDay(a)} and ${niceDay(b)}`;
}

// The short "what is missing" note on a Next events row.
export function eventNote(e: { stage: string; guests: number; time?: string | null; pick?: string; hasDraft: boolean; valueText: string }): string {
  if (!(e.guests > 0) && e.stage === 'confirmed') return 'Guest count missing';
  const note = e.pick ? `${e.pick.toLowerCase()} not picked`
    : e.stage === 'inquiry' ? (e.hasDraft ? 'quote not sent' : 'no quote yet')
      : e.stage === 'confirmed' || e.stage === 'invoiced' ? e.valueText : '';
  return [clock(e.time), e.guests > 0 ? `${e.guests} guests` : '', note].filter(Boolean).join(' · ');
}

export interface SweetRow { key: string; when: string; name: string; line: string; amount: number; late: boolean }
interface PreLike { id: string; customer_name: string; delivery_date?: string; status: string; total_amount: number; advance_paid: number; fulfillment?: string; address?: string }

// Pre-bookings due in the next 7 days, then unpaid bills.
export function sweetsWeek(pre: PreLike[], unpaid: { id: string; name: string; no: string; day: string; items: number; due: number }[], today: string): SweetRow[] {
  const end = addDays(today, 7);
  const soon = pre.filter(p => !['delivered', 'cancelled'].includes(p.status) && !!p.delivery_date && p.delivery_date >= today && p.delivery_date <= end)
    .sort((a, b) => (a.delivery_date ?? '').localeCompare(b.delivery_date ?? ''))
    .map((p): SweetRow => ({
      key: p.id, when: weekDay(p.delivery_date!), name: `${p.customer_name} · pre-booking`, amount: p.total_amount, late: false,
      line: `${p.fulfillment === 'delivery' ? 'Delivery' : 'Pickup'} · ${p.advance_paid > 0 ? `${inr(p.advance_paid)} advance` : 'no advance'}`,
    }));
  const bills = unpaid.map((u): SweetRow => ({ key: u.id, when: 'Unpaid', name: `${u.name} · bill #${u.no}`, line: `${niceDay(u.day)} · ${u.items} item${u.items === 1 ? '' : 's'}`, amount: u.due, late: daysBetween(u.day, today) > 0 }));
  return [...soon, ...bills];
}
