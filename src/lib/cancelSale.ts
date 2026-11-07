import type { SeasonalOrder } from '../hooks/useSeasonalOrders';
import type { SeasonalPreorder } from '../hooks/useSeasonalPreorders';
import type { Role } from '../components/navItems';
import { Payment, PayMode, billPayments, billLedger, preorderPayments, preorderLedger, paidOf, paidBy } from './payments';
import { KEEP_DAYS } from './recycleBin';
import { roundMoney } from './units';

// Cancelling a counter bill or pre-booking at any stage: reason, optional refund, who may cancel or delete.

export interface Refund { amount: number; mode: PayMode }
export interface CancelInput { reason: string; refund: Refund | null; at: string }

// Counter staff may cancel; only owners delete, since the recycle bin lives in Settings.
export const canCancelSale = (role: Role) => role === 'owner' || role === 'counter';
export const canDeleteSale = (role: Role) => role === 'owner';

// Everything received so far (refunds netted), offered back in the mode most of it came in.
export const refundStart = (payments: Payment[]): Refund => ({
  amount: Math.max(0, paidOf(payments)),
  mode: paidBy(payments, 'upi') > paidBy(payments, 'cash') ? 'upi' : 'cash',
});

// Money handed back as one negative entry, never more than was received.
export function withRefund(payments: Payment[], refund: Refund | null, at: string): Payment[] {
  const amount = refund ? Math.min(roundMoney(refund.amount), Math.max(0, paidOf(payments))) : 0;
  return refund && amount > 0 ? [...payments, { amount: -amount, mode: refund.mode, at, kind: 'refund' }] : payments;
}

export const cancelBillFields = (o: SeasonalOrder, c: CancelInput) => ({
  cancelled_at: c.at, cancel_reason: c.reason, ...billLedger(o.total_amount, withRefund(billPayments(o), c.refund, c.at), true),
});

const NOTE_TAG = 'Cancelled: ';
// Before the cancel columns exist the reason is kept at the end of the note.
export const cancelNote = (notes: string | undefined, reason: string) => [notes?.trim(), `${NOTE_TAG}${reason}`].filter(Boolean).join(' · ');

export const cancelBookingFields = (p: SeasonalPreorder, c: CancelInput, hasColumns: boolean) => ({
  status: 'cancelled' as const,
  ...preorderLedger(withRefund(preorderPayments(p), c.refund, c.at)),
  ...(hasColumns ? { cancelled_at: c.at, cancel_reason: c.reason } : { notes: cancelNote(p.notes, c.reason) }),
});

export function bookingCancelReason(p: Pick<SeasonalPreorder, 'status' | 'cancel_reason' | 'notes'>): string | undefined {
  if (p.status !== 'cancelled') return undefined;
  if (p.cancel_reason) return p.cancel_reason;
  const at = p.notes?.lastIndexOf(NOTE_TAG) ?? -1;
  return at >= 0 ? p.notes!.slice(at + NOTE_TAG.length) : undefined;
}

export const deleteMessage = (what: string) =>
  `${what} goes to the recycle bin for ${KEEP_DAYS} days. You can restore it from Settings → Recycle bin.`;
