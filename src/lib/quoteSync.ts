import { Booking } from '../types';

type QuoteLite = { id: string; booking_id?: string | null; status: 'draft' | 'sent' | 'accepted' | 'rejected' };
export type SyncWhy = 'booked' | 'cancelled' | 'passed';
export interface SyncFix { id: string; to: 'accepted' | 'rejected'; why: SyncWhy }

const FINAL = ['confirmed', 'completed'];
const OPEN = ['inquiry', 'followup', 'pending'];

// Quotes whose status no longer matches their booking, and what each should become.
// `needsPick` marks quotes still waiting for the customer's choice; those are accepted by hand, not here.
export function outOfStep<Q extends QuoteLite>(quotes: Q[], bookings: Pick<Booking, 'id' | 'status' | 'event_date'>[], today: string, needsPick: (q: Q) => boolean = () => false): SyncFix[] {
  const byId = new Map(bookings.map(b => [b.id, b]));
  const live = (bid: string) => quotes.filter(q => q.booking_id === bid && q.status !== 'rejected');
  const fixes: SyncFix[] = [];
  for (const q of quotes) {
    const b = q.booking_id ? byId.get(q.booking_id) : undefined;
    if (!b || q.status === 'rejected') continue;
    if (b.status === 'cancelled') fixes.push({ id: q.id, to: 'rejected', why: 'cancelled' });
    else if (FINAL.includes(b.status) && q.status !== 'accepted' && live(b.id).length === 1 && !needsPick(q))
      fixes.push({ id: q.id, to: 'accepted', why: 'booked' });
    else if (OPEN.includes(b.status) && b.event_date < today && q.status !== 'accepted') fixes.push({ id: q.id, to: 'rejected', why: 'passed' });
  }
  return fixes;
}

export const fixCounts = (fixes: SyncFix[]) => ({
  booked: fixes.filter(f => f.why === 'booked').length,
  cancelled: fixes.filter(f => f.why === 'cancelled').length,
  passed: fixes.filter(f => f.why === 'passed').length,
});
