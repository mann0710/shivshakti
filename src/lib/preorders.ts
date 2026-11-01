import type { SeasonalPreorder } from '../hooks/useSeasonalPreorders';
import { roundMoney } from './units';
import { addDays } from './reports/model';

export type PreStatus = SeasonalPreorder['status'];
export type Fulfillment = 'pickup' | 'delivery';

// Booked → Packed → Handed over; cancelled at any point. Older 'confirmed' rows read as booked.
export const OPEN_STATUSES: PreStatus[] = ['pending', 'confirmed', 'ready'];
export const STATUS_LABEL: Record<PreStatus, string> = {
  pending: 'Booked', confirmed: 'Booked', ready: 'Packed', delivered: 'Handed over', cancelled: 'Cancelled',
};

export const isPacked = (p: Pick<SeasonalPreorder, 'status'>) => p.status === 'ready' || p.status === 'delivered';
// Ticking Packed moves a booking to packed; unticking puts it back to booked.
export const packedToggle = (p: Pick<SeasonalPreorder, 'status'>): PreStatus => (p.status === 'ready' ? 'pending' : 'ready');

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

// Pickup-date filter: '' means no limit; a booking without a date only shows with no limit.
export interface DateSpan { from: string; to: string }
export type Preset = 'all' | 'today' | 'tomorrow' | 'next3' | 'week' | 'custom';
export const ALL_DATES: DateSpan = { from: '', to: '' };
export const inDateSpan = (p: Pick<SeasonalPreorder, 'delivery_date'>, s: DateSpan) =>
  (!s.from && !s.to) || (!!p.delivery_date && (!s.from || p.delivery_date >= s.from) && (!s.to || p.delivery_date <= s.to));
export const presetSpan = (k: Preset, today: string): DateSpan =>
  k === 'today' ? { from: today, to: today }
    : k === 'tomorrow' ? { from: addDays(today, 1), to: addDays(today, 1) }
      : k === 'next3' ? { from: today, to: addDays(today, 2) }
        : k === 'week' ? { from: today, to: addDays(today, 6) } : ALL_DATES;
