import type { SeasonalPreorder } from '../hooks/useSeasonalPreorders';
import { roundMoney } from './units';

export type PreStatus = SeasonalPreorder['status'];
export type Fulfillment = 'pickup' | 'delivery';

// pending → confirmed → ready (packed) → delivered; cancelled at any point.
export const OPEN_STATUSES: PreStatus[] = ['pending', 'confirmed', 'ready'];
export const STATUS_LABEL: Record<PreStatus, string> = {
  pending: 'Pending', confirmed: 'Confirmed', ready: 'Packed', delivered: 'Handed over', cancelled: 'Cancelled',
};

export const isOpenPreorder = (p: Pick<SeasonalPreorder, 'status'>) => OPEN_STATUSES.includes(p.status);
export const balanceOf = (p: Pick<SeasonalPreorder, 'total_amount' | 'advance_paid'>) => Math.max(0, roundMoney(p.total_amount - p.advance_paid));

// Advance taken at booking vs. money collected at hand-over (advance_paid holds both).
export const advanceAtBooking = (p: SeasonalPreorder) => Math.max(0, roundMoney(p.advance_paid - (p.balance_paid ?? 0)));
export const fulfillmentOf = (p: Pick<SeasonalPreorder, 'fulfillment' | 'address'>): Fulfillment =>
  p.fulfillment ?? (p.address?.trim() ? 'delivery' : 'pickup');
export const FULFILLMENT_LABEL: Record<Fulfillment, string> = { pickup: 'Pickup', delivery: 'Home delivery' };

// Day it was handed over (IST), falling back to its due date for older rows.
export const handedOverOn = (p: SeasonalPreorder): string | null =>
  p.status !== 'delivered' ? null : p.delivered_at ? istDay(p.delivered_at) : p.delivery_date ?? istDay(p.created_at);

export const istDay = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

export const modeLabel = (m?: string | null) =>
  !m ? 'Not recorded' : m === 'upi' ? 'UPI' : m === 'bank_transfer' ? 'Bank transfer' : m.charAt(0).toUpperCase() + m.slice(1);
