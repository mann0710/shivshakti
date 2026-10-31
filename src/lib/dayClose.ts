import type { SeasonalOrder } from '../hooks/useSeasonalOrders';
import type { SeasonalPreorder } from '../hooks/useSeasonalPreorders';
import { moneyIn } from './payments';
import { billDue } from './dues';
import { roundMoney } from './units';

export const NOTES = ['500', '200', '100', '50', '20', '10'] as const;
export type NoteKey = typeof NOTES[number] | 'coins';
export type NoteCounts = Partial<Record<NoteKey, number>>; // notes by count; coins as a rupee amount

export interface DayClose {
  id: string;
  day: string;
  from_at: string | null;
  closed_at: string;
  opening_cash: number;
  cash_bills: number;
  cash_advances: number;
  cash_handover: number;
  cash_dues: number;
  cash_out: number;
  cash_out_note: string | null;
  expected_cash: number;
  counted_cash: number;
  note_counts: NoteCounts;
  keep_cash: number;
  upi_total: number;
  sales_total: number;
  bills_count: number;
  unpaid_total: number;
  note: string | null;
  reopened_at: string | null;
  created_at: string;
}
export type DayClosePayload = Omit<DayClose, 'id' | 'created_at' | 'reopened_at'>;

const IST = 'Asia/Kolkata';
const ROLLOVER_HOURS = 4; // a shop day runs 4 am to 4 am, so closing after midnight still closes "today"
const time = (iso: string) => Date.parse(iso) || 0;

export const istDate = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: IST });
export const shopDay = (now: Date) => istDate(new Date(now.getTime() - ROLLOVER_HOURS * 3600e3));
export const nextDay = (day: string) => istDate(new Date(time(`${day}T12:00:00+05:30`) + 86400e3));
export const dayStart = (day: string, hour = 0) => new Date(`${day}T${String(hour).padStart(2, '0')}:00:00+05:30`).toISOString();

export const dayLabel = (day: string) =>
  new Date(`${day}T12:00:00+05:30`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: IST });
export const whenLabel = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: IST });

export const activeCloses = (closes: DayClose[]) =>
  closes.filter(c => !c.reopened_at).sort((a, b) => time(b.closed_at) - time(a.closed_at));

export interface OpenWindow { day: string; from: string; last?: DayClose }

// The day being counted: from the last close (or this morning) until now; after a close, money counts for the next day.
export function openWindow(closes: DayClose[], now: Date): OpenWindow {
  const last = activeCloses(closes)[0];
  const today = shopDay(now);
  const day = last && last.day >= today ? nextDay(last.day) : today;
  return { day, from: last ? last.closed_at : dayStart(today, ROLLOVER_HOURS), last };
}

export interface DaySummary {
  cash_bills: number; cash_advances: number; cash_handover: number; cash_dues: number;
  cash: number; upi_total: number; upi_count: number;
  sales_total: number; bills_count: number; unpaid_total: number;
}

// Money received between two times, by where it came from; old dues are bills made before the window.
export function summarize(orders: SeasonalOrder[], preorders: SeasonalPreorder[], from: string, to: string): DaySummary {
  const [start, end] = [time(from), time(to)];
  const inside = (iso: string) => time(iso) > start && time(iso) <= end;
  const s = { cash_bills: 0, cash_advances: 0, cash_handover: 0, cash_dues: 0, upi_total: 0, upi_count: 0 };
  const add = (mode: string, amount: number, bucket: 'cash_bills' | 'cash_advances' | 'cash_handover' | 'cash_dues') => {
    if (mode === 'upi') { s.upi_total += amount; s.upi_count += Math.sign(amount); } else s[bucket] += amount; // a refund cancels its payment
  };
  moneyIn(orders, preorders).filter(p => inside(p.at)).forEach(p => add(p.mode, p.amount,
    p.source === 'bill' ? (inside(p.madeAt) ? 'cash_bills' : 'cash_dues')
      : p.kind === 'advance' ? 'cash_advances' : p.kind === 'handover' ? 'cash_handover' : 'cash_dues'));
  const bills = orders.filter(o => inside(o.created_at) && !o.cancelled_at);
  const r = (n: number) => roundMoney(n);
  return {
    cash_bills: r(s.cash_bills), cash_advances: r(s.cash_advances), cash_handover: r(s.cash_handover), cash_dues: r(s.cash_dues),
    cash: r(s.cash_bills + s.cash_advances + s.cash_handover + s.cash_dues),
    upi_total: r(s.upi_total), upi_count: s.upi_count,
    sales_total: r(bills.reduce((t, o) => t + o.total_amount, 0)), bills_count: bills.length,
    unpaid_total: r(bills.reduce((t, o) => t + billDue(o), 0)),
  };
}

export const countedOf = (c: NoteCounts) =>
  roundMoney(NOTES.reduce((t, n) => t + Number(n) * (Number(c[n]) || 0), 0) + (Number(c.coins) || 0));

export const expectedOf = (opening: number, s: Pick<DaySummary, 'cash'>, cashOut: number) => roundMoney(opening + s.cash - cashOut);

export interface CloseInput { opening: number; cashOut: number; cashOutNote: string; notes: NoteCounts; keep: number; note: string }

export function buildClose(w: OpenWindow, s: DaySummary, i: CloseInput, closedAt: string): DayClosePayload {
  return {
    day: w.day, from_at: w.from, closed_at: closedAt,
    opening_cash: i.opening, cash_bills: s.cash_bills, cash_advances: s.cash_advances, cash_handover: s.cash_handover, cash_dues: s.cash_dues,
    cash_out: i.cashOut, cash_out_note: i.cashOutNote.trim() || null,
    expected_cash: expectedOf(i.opening, s, i.cashOut), counted_cash: countedOf(i.notes), note_counts: i.notes,
    keep_cash: i.keep, upi_total: s.upi_total, sales_total: s.sales_total, bills_count: s.bills_count, unpaid_total: s.unpaid_total,
    note: i.note.trim() || null,
  };
}

export const differenceOf = (c: Pick<DayClose, 'counted_cash' | 'expected_cash'>) => roundMoney(c.counted_cash - c.expected_cash);
export const differenceLabel = (d: number) => (d === 0 ? 'Matches' : d < 0 ? 'Short' : 'Extra');
