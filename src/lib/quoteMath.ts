// Shared catering money math so quotations and invoices can't drift apart.

interface MealLike { per_plate_amount?: number; discount_amount?: number; guest_count?: number }
interface DayLike { meals?: MealLike[] }
interface Charge { amount?: number }

// A meal's "offer" rate is stored in discount_amount; savings = (rate - offer) × guests.
export const mealSavings = (days: DayLike[] | null | undefined): number =>
  (days ?? []).reduce((s, d) => s + (d.meals ?? []).reduce((ms, m) => {
    const offer = Number(m.discount_amount) || 0;
    const rate = Number(m.per_plate_amount) || 0;
    return offer > 0 && rate > offer ? ms + (rate - offer) * (Number(m.guest_count) || 0) : ms;
  }, 0), 0);

export const sumCharges = (list: Charge[] | null | undefined) =>
  (list ?? []).reduce((s, c) => s + (Number(c.amount) || 0), 0);

// Accepted quotation first, else the newest one for the booking.
export function pickQuotation<T extends { booking_id?: string | null; status?: string; created_at: string }>(list: T[], bookingId: string): T | undefined {
  const mine = list.filter(q => q.booking_id === bookingId).sort((a, b) => b.created_at.localeCompare(a.created_at));
  return mine.find(q => q.status === 'accepted') ?? mine.find(q => q.status !== 'rejected') ?? mine[0];
}

// WhatsApp needs the country code; 10-digit Indian numbers get 91.
export const waNumber = (phone: string | undefined | null) => {
  const d = (phone ?? '').replace(/\D/g, '');
  return d.length === 10 ? `91${d}` : d;
};
