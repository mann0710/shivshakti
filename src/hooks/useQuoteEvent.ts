import { useEffect, useState } from 'react';
import { Booking } from '../types';
import { useUpdateBooking } from './useBookings';

export interface EventDraft { eventType: string; date: string; time: string; venue: string }

const blankDraft: EventDraft = { eventType: '', date: '', time: '', venue: '' };
const fromBooking = (b?: Booking): EventDraft => (b
  ? { eventType: b.event_type || '', date: b.event_date || '', time: b.event_time?.slice(0, 5) || '', venue: b.venue || '' }
  : blankDraft);

// The quote's booking and its event details; edits are saved back to the booking.
export const useQuoteEvent = (bookings: Booking[]) => {
  const updateBooking = useUpdateBooking();
  const [bookingId, setBookingId] = useState('');
  const [draft, setDraft] = useState<EventDraft>(blankDraft);
  const [guests, setGuests] = useState('');

  const booking = bookings.find(b => b.id === bookingId);
  // A booking made a moment ago shows up after the refetch; fill its details then.
  useEffect(() => { if (booking && !draft.date && !draft.eventType) setDraft(fromBooking(booking)); }, [booking?.id]); // eslint-disable-line

  const selectBooking = (id: string, guestCount?: number, known?: Booking) => {
    const b = known ?? bookings.find(x => x.id === id);
    setBookingId(id);
    setDraft(fromBooking(b));
    setGuests(String(guestCount || b?.guest_count || ''));
  };

  const reset = () => { setBookingId(''); setDraft(blankDraft); setGuests(''); };
  const patch = (p: Partial<EventDraft>) => setDraft(d => ({ ...d, ...p }));

  // Event type, date, time, venue and (single-day) guests typed in the quote go to the booking.
  const syncBooking = async (id: string, withGuests: boolean) => {
    const b = bookings.find(x => x.id === id);
    if (!b) return;
    const n = parseInt(guests, 10) || 0;
    const change: Partial<Booking> = {};
    if (draft.eventType.trim() && draft.eventType.trim() !== b.event_type) change.event_type = draft.eventType.trim();
    if (draft.date && draft.date !== b.event_date) {
      change.event_date = draft.date;
      if (b.end_date && b.end_date < draft.date) change.end_date = draft.date;
    }
    if ((draft.time || '') !== (b.event_time?.slice(0, 5) || '')) change.event_time = draft.time || null;
    if (draft.venue.trim() !== (b.venue || '')) change.venue = draft.venue.trim();
    if (withGuests && n > 0 && n !== b.guest_count) change.guest_count = n;
    if (Object.keys(change).length) await updateBooking.mutateAsync({ id, ...change });
  };

  return { bookingId, booking, draft, patch, guests, setGuests, selectBooking, reset, syncBooking };
};

export type QuoteEvent = ReturnType<typeof useQuoteEvent>;
