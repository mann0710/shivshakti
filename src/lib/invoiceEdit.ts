import type { Booking, Invoice, LineItem, Payment } from '../types';
import type { Quotation } from '../hooks/useQuotations';
import { servedItems } from './quoteChoices';
import { mealSavings } from './quoteMath';
import { clock } from './homeNeeds';
import { daysBetween } from './cateringTodo';
import { inr } from './money';
import { formatDateIST } from './ist';

// Invoice editor maths: meals with final counts, extras, discount, the summary and the payment plan.

export interface MealRow {
  key: string;
  day: number;            // index into event_days, -1 for a single-day invoice
  meal: number;
  name: string;
  note: string;
  warn: boolean;
  guests: number;
  rate: number;
  total: number;
  dishes: string[];
  rateEditable: boolean;
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const guessMeal = (time?: string) => {
  const h = Number((time ?? '').split(':')[0]);
  return !time ? '' : h < 11 ? 'breakfast' : h < 16 ? 'lunch' : h < 19 ? 'hi-tea' : 'dinner';
};
const lastPart = (s: string) => s.split('›').pop()!.split('·').pop()!.trim();

// One row per meal; a repeated meal type on the same day is flagged so it can be fixed.
export function mealRows(inv: Pick<Invoice, 'is_multi_day' | 'event_days' | 'subtotal' | 'line_items'>, eventDays: any[], plateRate: number): MealRow[] {
  if (inv.is_multi_day && eventDays.length) {
    const many = eventDays.length > 1;
    return eventDays.flatMap((d: any, di: number) => (d.meals ?? []).map((m: any, mi: number): MealRow => {
      const type = String(m.meal_type ?? 'meal');
      const repeat = (d.meals as any[]).slice(0, mi).some(x => x.meal_type === m.meal_type);
      const guess = guessMeal(m.time);
      const note = repeat ? `Saved as "${type}"${m.time ? ` at ${clock(m.time)}` : ''}${guess && guess !== type ? ` — ${guess}?` : ''}`
        : m.time ? clock(m.time) : 'No time set';
      return {
        key: `${di}-${mi}`, day: di, meal: mi, name: `${repeat ? 'Second meal' : cap(type)}${many ? ` · Day ${d.day_number ?? di + 1}` : ''}`,
        note, warn: repeat, guests: Number(m.guest_count) || 0, rate: Number(m.per_plate_amount) || 0, total: Number(m.subtotal) || 0,
        dishes: servedItems(m.items).map((x: any) => x.item_name), rateEditable: true,
      };
    }));
  }
  const dishes = (inv.line_items ?? []).map(l => lastPart(l.description));
  const guests = plateRate > 0 ? Math.round(inv.subtotal / plateRate) : 0;
  return [{ key: 'single', day: -1, meal: 0, name: 'Food', note: plateRate > 0 ? '' : 'Priced per dish', warn: false, guests, rate: plateRate, total: inv.subtotal, dishes, rateEditable: false }];
}

// New event_days with one meal's guests or plate rate changed and the totals redone.
export function editMeal(days: any[], di: number, mi: number, patch: { guests?: number; rate?: number }): any[] {
  return days.map((d: any, i: number) => {
    if (i !== di) return d;
    const meals = (d.meals as any[]).map((m: any, j: number) => {
      if (j !== mi) return m;
      const guest_count = patch.guests ?? m.guest_count;
      const per_plate_amount = patch.rate ?? m.per_plate_amount;
      return { ...m, guest_count, per_plate_amount, subtotal: guest_count * (per_plate_amount || 0) };
    });
    return { ...d, meals, day_subtotal: meals.reduce((s: number, m: any) => s + (m.subtotal || 0), 0) };
  });
}

export const daysSubtotal = (days: any[]) => days.reduce((s: number, d: any) => s + (d.day_subtotal || 0), 0);
export const offerSavings = mealSavings;

// "10%" is a share of the meals; anything else is rupees.
export function parseDiscount(text: string, base: number): number {
  const t = text.replace(/[₹,\s]/g, '');
  if (!t) return 0;
  const pct = t.endsWith('%');
  const n = Math.max(0, Number(pct ? t.slice(0, -1) : t) || 0);
  return Math.min(base, pct ? Math.round((base * Math.min(n, 100)) / 100) : n);
}

export const amountOf = (text: string) => Math.max(0, Number(String(text).replace(/[₹,\s]/g, '')) || 0);

export type PayState = 'Paid' | 'Part paid' | 'Not paid';
export const payState = (inv: Pick<Invoice, 'advance_paid' | 'balance_due'>): PayState =>
  inv.balance_due <= 0 && inv.advance_paid > 0 ? 'Paid' : inv.advance_paid > 0 ? 'Part paid' : 'Not paid';
export const PAY_CHIP: Record<PayState, { bg: string; fg: string }> = {
  Paid: { bg: '#E1F5EE', fg: '#0F6E56' }, 'Part paid': { bg: '#FAEEDA', fg: '#7A4A0A' }, 'Not paid': { bg: '#FCEBEB', fg: '#A32D2D' },
};

export interface SumLine { k: string; v: string; big?: boolean; rule?: boolean; tone?: 'good' | 'bad' }

// Right-hand summary: meals, extras, discount, GST, total, paid, balance.
export function summaryLines(inv: Invoice): SumLine[] {
  const extras = (inv.extra_charges ?? []).reduce((s, c) => s + (c.amount || 0), 0) + (inv.transportation_charge || 0);
  return [
    { k: 'Meals', v: inr(inv.subtotal) },
    ...(extras > 0 ? [{ k: 'Extras', v: inr(extras) }] : []),
    ...(inv.discount_amount > 0 ? [{ k: 'Discount', v: `− ${inr(inv.discount_amount)}` }] : []),
    ...(inv.gst_amount > 0 ? [{ k: `GST ${inv.gst_rate}%`, v: inr(inv.gst_amount) }] : []),
    { k: 'Total', v: inr(inv.total_amount), big: true, rule: true },
    { k: 'Paid', v: `− ${inr(inv.advance_paid)}`, tone: 'good' },
    { k: 'Balance', v: inr(inv.balance_due), big: true, rule: true, tone: inv.balance_due > 0 ? 'bad' : 'good' },
  ];
}

const MODE_TEXT: Record<string, string> = { cash: 'cash', upi: 'UPI', bank_transfer: 'bank', cheque: 'cheque' };
export const modeText = (m: string) => MODE_TEXT[m] ?? m;
const longDay = (iso: string) => formatDateIST(iso, 'EEE d MMM');

export interface PlanRow { key: string; when: string; what: string; amount: number; status: string; tone: 'good' | 'bad' | 'wait'; payment?: Payment }

// Payments received, then the balance still to come.
export function paymentPlan(payments: Payment[], inv: Pick<Invoice, 'balance_due'>, eventDate: string | undefined, today: string): PlanRow[] {
  const rows: PlanRow[] = [...payments].sort((a, b) => a.payment_date.localeCompare(b.payment_date)).map(p => ({
    key: p.id, when: longDay(p.payment_date), what: `${p.payment_type === 'advance' ? 'Advance' : 'Payment'} · ${modeText(p.payment_mode)}`,
    amount: p.amount, status: 'Received', tone: 'good', payment: p,
  }));
  if (inv.balance_due > 0) {
    const late = eventDate && eventDate < today ? daysBetween(eventDate, today) : 0;
    rows.push({ key: 'balance', when: eventDate && eventDate >= today ? 'On the event day' : 'After the event', what: 'Balance', amount: inv.balance_due,
      status: late > 0 ? `${late} days` : 'Due', tone: late > 0 ? 'bad' : 'wait' });
  }
  return rows;
}

// Full balance and half, as on the payment dialog.
export const quickAmounts = (balance: number) => (balance > 0
  ? [{ label: `Full balance ${inr(balance)}`, value: balance }, ...(balance >= 2 ? [{ label: `Half ${inr(Math.ceil(balance / 2))}`, value: Math.ceil(balance / 2) }] : [])]
  : []);

export const afterThis = (balance: number, amount: number) => (amount >= balance ? 'Paid in full' : `${inr(balance - amount)} still due`);

// Neither the booking nor its quote has a guest count, so the invoice needs the final one.
export const needsGuests = (q: Pick<Quotation, 'guest_count'> | undefined, b?: Pick<Booking, 'guest_count'>) =>
  !((b?.guest_count ?? 0) > 0) && !((q?.guest_count ?? 0) > 0);

// The invoice a confirmed booking gets from its accepted quote; final guests reprice a per-plate single-day quote.
export function invoiceFromQuote(booking: Booking, quote: Quotation | undefined, guests?: number): Partial<Invoice> {
  if (!quote) {
    const line: LineItem = { description: `${booking.menu?.name || 'Catering'} × ${booking.guest_count} guests`, quantity: booking.guest_count, unit_price: booking.menu?.price_per_plate || 0, total: booking.estimated_cost };
    return { booking_id: booking.id, subtotal: booking.estimated_cost, line_items: [line], discount_amount: 0, discount_type: 'amount', gst_rate: 0, gst_amount: 0, extra_charges: [], transportation_charges: [], additional_discounts: [] };
  }
  const multi = !!quote.is_multi_day && !!quote.event_days?.length;
  const line_items: LineItem[] = multi
    ? quote.event_days!.flatMap(d => d.meals.flatMap(m => servedItems(m.items).map(i => ({ description: `Day ${d.day_number} · ${m.meal_type} · ${i.item_name}`, quantity: m.guest_count, unit_price: i.amount, total: i.amount }))))
    : servedItems(quote.items).map(i => ({ description: `${i.category_name} › ${i.subcategory_name} › ${i.item_name}`, quantity: 1, unit_price: i.amount, total: i.amount }));
  const reprice = !multi && quote.per_plate_amount > 0 && !!guests && guests > 0 && guests !== quote.guest_count;
  const subtotal = reprice ? quote.per_plate_amount * guests! : quote.subtotal;
  const gst_amount = reprice && quote.gst_rate > 0 ? Math.round(((subtotal - quote.discount_amount) * quote.gst_rate) / 100) : quote.gst_amount;
  return {
    booking_id: booking.id, quotation_id: quote.id, subtotal, line_items,
    discount_amount: quote.discount_amount, discount_type: quote.discount_type, gst_rate: quote.gst_rate, gst_amount,
    extra_charges: quote.extra_charges || [], transportation_charges: quote.transportation_charges || [], additional_discounts: quote.additional_discounts || [],
    is_multi_day: quote.is_multi_day, event_days: quote.event_days,
  };
}

// Same order as the Invoices page: quote total, else the booking's estimate.
export const quoteValue = (q: Pick<Quotation, 'total_amount'> | undefined, b: Pick<Booking, 'estimated_cost'>) => q?.total_amount ?? b.estimated_cost ?? 0;
