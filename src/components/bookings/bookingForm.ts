import type { Booking } from '../../types';
import { isValidPhone } from '../../lib/money';

// The booking form's data: blank, from a booking, checks, and what gets saved.
export const FOOD_STYLES = ['Regular', 'Jain', 'Swaminarayan'];

export interface BookingForm {
  customer_id: string; newName: string; newPhone: string;
  event_type: string; other: boolean;
  event_date: string; multiDay: boolean; end_date: string; event_time: string;
  venue: string; guest_count: string; food: string; notes: string;
}

export const blankForm = (date = ''): BookingForm => ({
  customer_id: '', newName: '', newPhone: '', event_type: '', other: false,
  event_date: date, multiDay: false, end_date: '', event_time: '', venue: '', guest_count: '', food: 'Regular', notes: '',
});

// Older bookings kept the food style on the first line of the notes; it moves to food_type on the next save.
const FOOD_LINE = /^Food style: (Regular|Jain|Swaminarayan)[ \t]*(?:\r?\n|$)/i;
export const splitFood = (text = '') => {
  const m = text.match(FOOD_LINE);
  return m ? { food: FOOD_STYLES.find(f => f.toLowerCase() === m[1].toLowerCase())!, notes: text.slice(m[0].length) } : { food: 'Regular', notes: text };
};

export const formFromBooking = (b: Booking): BookingForm => ({
  ...blankForm(b.event_date), ...splitFood(b.special_instructions ?? ''), ...(b.food_type ? { food: b.food_type } : {}),
  customer_id: b.customer_id, event_type: b.event_type,
  multiDay: !!(b.end_date && b.end_date !== b.event_date), end_date: b.end_date ?? '',
  event_time: b.event_time?.slice(0, 5) ?? '', venue: b.venue ?? '', guest_count: b.guest_count ? String(b.guest_count) : '',
});

export type FormErrors = Partial<Record<'customer' | 'event' | 'date' | 'end', string>>;

// Errors shown under each field; an empty object means the form can be saved.
export function formErrors(f: BookingForm, eventType: string, isNew: boolean): FormErrors {
  const e: FormErrors = {};
  if (isNew && !f.customer_id && !f.newName.trim()) e.customer = 'Pick a customer, or type a new name and phone';
  else if (isNew && !f.customer_id && f.newPhone.trim() && !isValidPhone(f.newPhone)) e.customer = 'Phone must be a 10-digit mobile number';
  if (!eventType) e.event = 'Type the event name';
  if (!f.event_date) e.date = 'Pick the event date';
  if (f.multiDay && !f.end_date) e.end = 'Pick the last day';
  else if (f.multiDay && f.end_date < f.event_date) e.end = 'The last day is before the first day';
  return e;
}

// Columns written to the booking (null clears a field on edit).
export const bookingFields = (f: BookingForm, eventType: string) => ({
  event_type: eventType, event_date: f.event_date, event_time: f.event_time || null,
  end_date: f.multiDay && f.end_date ? f.end_date : null, venue: f.venue.trim(),
  guest_count: parseInt(f.guest_count, 10) || 0, food_type: f.food || 'Regular', special_instructions: f.notes.trim(),
});

type Slot = Pick<Booking, 'id' | 'event_date' | 'end_date' | 'status' | 'event_type'> & { customer?: { name: string } };

// "Free that day · 0 other events", or who else is on.
export function dayHint(bookings: Slot[], start: string, end: string, ignoreId?: string): { text: string; busy: boolean } | null {
  if (!start) return null;
  const last = end && end > start ? end : start;
  const span = last > start ? 'on those days' : 'that day';
  const others = bookings.filter(b => b.id !== ignoreId && b.status !== 'cancelled'
    && b.event_date <= last && (b.end_date && b.end_date > b.event_date ? b.end_date : b.event_date) >= start);
  if (!others.length) return { text: `Free ${span} · 0 other events`, busy: false };
  const names = others.slice(0, 2).map(b => `${b.customer?.name ?? 'a customer'} (${b.event_type})`).join(', ');
  return { text: `${others.length} other event${others.length > 1 ? 's' : ''} ${span}: ${names}${others.length > 2 ? ' and more' : ''}`, busy: true };
}

// Customers matching a name or at least 3 digits of a phone; names starting with the text first.
export function findCustomers<T extends { name: string; phone?: string }>(list: T[], query: string, max = 6): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return list.slice(0, max);
  const digits = q.replace(/\D/g, '');
  const hit = (c: T) => c.name.toLowerCase().includes(q) || (digits.length >= 3 && (c.phone ?? '').replace(/\D/g, '').includes(digits));
  const starts = (c: T) => (c.name.toLowerCase().startsWith(q) ? 0 : 1);
  return list.filter(hit).sort((a, b) => starts(a) - starts(b)).slice(0, max);
}
