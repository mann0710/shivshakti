import { Booking } from '../../types';

// Booking statuses a person can set; invoiced and paid follow the invoice by themselves.
export const BOOKING_STATUSES: Booking['status'][] = ['inquiry', 'followup', 'confirmed', 'completed', 'cancelled'];
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const STATUS_TEXT: Record<Booking['status'], string> = {
  inquiry: 'Inquiry', followup: 'Quoted', confirmed: 'Confirmed', completed: 'Completed', cancelled: 'Lost or cancelled', pending: 'Pending',
};

// Plain-English hint beside each status in the Change status menu.
export const STATUS_HINT: Partial<Record<Booking['status'], string>> = {
  followup: 'waiting for a reply', completed: 'event is over', cancelled: 'no reply or went elsewhere',
};
