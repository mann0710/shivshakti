import { useState } from 'react';
import toast from 'react-hot-toast';
import { Booking } from '../types';
import { useCreateBooking, useUpdateBooking } from './useBookings';
import { useResolveCustomer } from './useResolveCustomer';

export type EventMode = 'new' | 'existing';
export interface EventDraft { customerId: string; newCustomer: boolean; name: string; phone: string; eventType: string; date: string; venue: string }

const blankDraft: EventDraft = { customerId: '', newCustomer: false, name: '', phone: '', eventType: '', date: '', venue: '' };

// The quote's customer + event: an existing booking, or a new one created when the quote is saved.
export const useQuoteEvent = (bookings: Booking[]) => {
  const createBooking = useCreateBooking();
  const updateBooking = useUpdateBooking();
  const resolveCustomer = useResolveCustomer();
  const [mode, setMode] = useState<EventMode>('new');
  const [bookingId, setBookingId] = useState('');
  const [draft, setDraft] = useState<EventDraft>(blankDraft);
  const [guests, setGuests] = useState('');

  const booking = bookings.find(b => b.id === bookingId);

  const selectBooking = (id: string, guestCount?: number) => {
    setMode('existing');
    setBookingId(id);
    const b = bookings.find(x => x.id === id);
    setGuests(String(guestCount || b?.guest_count || ''));
  };

  const reset = () => { setMode('new'); setBookingId(''); setDraft(blankDraft); setGuests(''); };
  const patch = (p: Partial<EventDraft>) => setDraft(d => ({ ...d, ...p }));

  // Returns the booking to attach the quote to, creating customer and booking for a new event.
  const resolve = async (): Promise<{ bookingId: string; customerId: string } | null> => {
    if (mode === 'existing') {
      if (!booking) { toast.error('Please select a booking'); return null; }
      return { bookingId: booking.id, customerId: booking.customer_id };
    }
    if (!draft.date) { toast.error('Event date is required'); return null; }
    const customerId = await resolveCustomer({ customerId: draft.newCustomer ? '' : draft.customerId, name: draft.name, phone: draft.phone });
    if (!customerId) return null;
    patch({ customerId, newCustomer: false });
    const created: Booking = await createBooking.mutateAsync({
      customer_id: customerId, event_type: draft.eventType.trim() || 'Other', event_date: draft.date,
      venue: draft.venue.trim(), guest_count: parseInt(guests, 10) || 0, status: 'inquiry', estimated_cost: 0,
    });
    // From here on it is an existing booking, so a failed quote save can't create it twice.
    setMode('existing');
    setBookingId(created.id);
    return { bookingId: created.id, customerId };
  };

  // Guest count typed in the quote becomes the booking's count.
  const syncGuests = async (id: string) => {
    const n = parseInt(guests, 10) || 0;
    const b = bookings.find(x => x.id === id);
    if (n > 0 && b && b.guest_count !== n) await updateBooking.mutateAsync({ id, guest_count: n });
  };

  return { mode, setMode, bookingId, booking, draft, patch, guests, setGuests, selectBooking, reset, resolve, syncGuests };
};

export type QuoteEvent = ReturnType<typeof useQuoteEvent>;
