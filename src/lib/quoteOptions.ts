import type { Quotation, QuotationPayload } from '../hooks/useQuotations';
import type { Booking } from '../types';
import { inr } from './money';

// Options A / B / C are sibling quotations sharing option_group; the customer accepts one.
const byLabel = (a: Quotation, b: Quotation) => (a.option_label || '').localeCompare(b.option_label || '') || a.created_at.localeCompare(b.created_at);

export const siblingsOf = (q: Quotation, all: Quotation[]) =>
  q.option_group ? all.filter(x => x.option_group === q.option_group).sort(byLabel) : [q];

export const nextLabel = (sibs: Quotation[]) => {
  const used = new Set(sibs.map(s => s.option_label));
  return 'ABCDEFGHIJ'.split('').find(l => !used.has(l)) ?? String(sibs.length + 1);
};

export const optionTitle = (q: Pick<Quotation, 'option_label' | 'option_name'>) =>
  q.option_label ? `Option ${q.option_label}${q.option_name ? ` · ${q.option_name}` : ''}` : '';

// A sibling that lost to the accepted option reads "Not chosen", not "Rejected".
export const statusText = (q: Pick<Quotation, 'status' | 'option_group'>) =>
  q.option_group && q.status === 'rejected' ? 'Not chosen' : q.status.charAt(0).toUpperCase() + q.status.slice(1);

export const totalText = (q: Pick<Quotation, 'total_amount' | 'total_max'>) =>
  q.total_max && q.total_max > q.total_amount ? `${inr(q.total_amount)} – ${inr(q.total_max)}` : inr(q.total_amount);

export const plateText = (q: Pick<Quotation, 'per_plate_amount' | 'per_plate_max'>) =>
  q.per_plate_max && q.per_plate_max > q.per_plate_amount ? `${inr(q.per_plate_amount)} – ${inr(q.per_plate_max)}` : inr(q.per_plate_amount);

// Guests on the quote, else the booking's, else the largest meal.
export const quoteGuests = (q: Pick<Quotation, 'guest_count' | 'booking' | 'event_days'>): number =>
  q.guest_count || q.booking?.guest_count
  || Math.max(0, ...(q.event_days || []).flatMap(d => (d.meals || []).map(m => m.guest_count || 0)));

// ISO dates a quote covers: its meal dates, else the booking's date range.
export function quoteDays(q: Pick<Quotation, 'is_multi_day' | 'event_days' | 'booking'>): string[] {
  const meal = q.is_multi_day ? (q.event_days ?? []).map(d => d.date).filter(Boolean) : [];
  if (meal.length) return Array.from(new Set(meal)).sort();
  const b = q.booking;
  if (!b?.event_date) return [];
  const out: string[] = [];
  const end = b.end_date && b.end_date > b.event_date ? b.end_date : b.event_date;
  for (let d = new Date(`${b.event_date}T00:00:00Z`); out.length < 15; d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    out.push(iso);
    if (iso >= end) break;
  }
  return out;
}

// "20 Dec already has 2 other quotes …" — empty when the day is free.
export function sameDayNote(date: string, venue: string, all: Quotation[], bookings: Booking[], skip: { id?: string; group?: string | null; bookingId?: string }): string {
  if (!date) return '';
  // Quotes for the same enquiry (same booking or option group) are not "others".
  const others = all.filter(q => q.id !== skip.id && (!skip.group || q.option_group !== skip.group)
    && (!skip.bookingId || q.booking_id !== skip.bookingId) && q.status !== 'rejected' && quoteDays(q).includes(date));
  // One line per enquiry: options of the same group count once.
  const seen = new Set<string>();
  const parts = others.filter(q => { const k = q.option_group || q.id; if (seen.has(k)) return false; seen.add(k); return true; })
    .map(q => `${q.customer?.name || 'Customer'} (${q.status === 'accepted' ? 'accepted' : q.status}${q.booking?.venue ? `, ${q.booking.venue}` : ''})`);
  const v = venue.trim().toLowerCase();
  const taken = v && bookings.some(b => b.id !== skip.bookingId && ['confirmed', 'completed'].includes(b.status)
    && (b.venue || '').trim().toLowerCase() === v && b.event_date <= date && (b.end_date || b.event_date) >= date);
  if (!parts.length && !taken) return '';
  const day = new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return [parts.length ? `${day} already has ${parts.length} other quote${parts.length === 1 ? '' : 's'}: ${parts.join(', ')}.` : '',
    taken ? `${venue} is already booked that day.` : '', 'You can still save this one.'].filter(Boolean).join(' ');
}

// Copy of a saved quote as a new draft (Clone and "+ Add option").
export const quoteCopy = (q: Quotation): QuotationPayload => ({
  customer_id: q.customer_id, booking_id: q.booking_id || null, items: q.items || [],
  per_plate_amount: q.per_plate_amount, guest_count: q.guest_count, subtotal: q.subtotal,
  discount_amount: q.discount_amount, discount_type: q.discount_type, gst_rate: q.gst_rate, gst_amount: q.gst_amount,
  extra_charges: q.extra_charges || [], transportation_charges: q.transportation_charges || [],
  additional_discounts: q.additional_discounts || [], total_amount: q.total_amount,
  notes: q.notes, food_type: q.food_type, status: 'draft',
  is_multi_day: q.is_multi_day || false, event_days: q.event_days || [],
  per_plate_max: q.per_plate_max ?? null, total_max: q.total_max ?? null,
});
