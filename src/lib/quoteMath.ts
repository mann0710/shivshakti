// Shared catering money math so quotations and invoices can't drift apart.

interface MealLike { per_plate_amount?: number; discount_amount?: number; guest_count?: number; subtotal?: number }
interface DayLike { meals?: MealLike[] }
interface Charge { amount?: number }

// A meal's "offer" rate is stored in discount_amount; savings = (rate - offer) × guests.
export const mealSavings = (days: DayLike[] | null | undefined): number =>
  (days ?? []).reduce((s, d) => s + (d.meals ?? []).reduce((ms, m) => {
    const offer = Number(m.discount_amount) || 0;
    const rate = Number(m.per_plate_amount) || 0;
    return offer > 0 && rate > offer ? ms + (rate - offer) * (Number(m.guest_count) || 0) : ms;
  }, 0), 0);

// What the customer pays for a meal / day: offer rate × guests when an offer is set.
export const mealNet = (m: MealLike) => {
  const offer = Number(m.discount_amount) || 0;
  return offer > 0 ? offer * (Number(m.guest_count) || 0) : Number(m.subtotal) || 0;
};
export const dayNet = (d: DayLike) => (d.meals ?? []).reduce((s, m) => s + mealNet(m), 0);

export const sumCharges = (list: Charge[] | null | undefined) =>
  (list ?? []).reduce((s, c) => s + (Number(c.amount) || 0), 0);

interface TotalsInput {
  isMultiDay: boolean;
  eventDays: { day_subtotal?: number; meals?: MealLike[] }[];
  perPlate: number;
  guests: number;
  additional: Charge[];
  gstRate: number;   // 0 when GST is off
  extra: number;
  transport: number;
}

// The quotation total, exactly as the editor builds it: subtotal − offers − discounts + GST + charges.
export function quoteTotals(t: TotalsInput) {
  const subtotal = t.isMultiDay ? t.eventDays.reduce((s, d) => s + (Number(d.day_subtotal) || 0), 0) : t.perPlate * t.guests;
  const mealSavingsTotal = t.isMultiDay ? mealSavings(t.eventDays) : 0;
  const discount = mealSavingsTotal + sumCharges(t.additional);
  const discounted = Math.max(0, subtotal - discount);
  const gst = t.gstRate > 0 ? Math.round((discounted * t.gstRate) / 100) : 0;
  return { subtotal, mealSavings: mealSavingsTotal, discount, gst, final: discounted + gst + t.extra + t.transport };
}

// Accepted quotation first, else the newest one for the booking.
export function pickQuotation<T extends { booking_id?: string | null; status?: string; created_at: string }>(list: T[], bookingId: string): T | undefined {
  const mine = list.filter(q => q.booking_id === bookingId).sort((a, b) => b.created_at.localeCompare(a.created_at));
  return mine.find(q => q.status === 'accepted') ?? mine.find(q => q.status !== 'rejected') ?? mine[0];
}

// Day number = ordinal position of date among unique dates in first-appearance order
export const getDayNumber = (date: string, days: { date: string }[]): number => {
  const seen: string[] = [];
  for (const d of days) {
    if (d.date && !seen.includes(d.date)) seen.push(d.date);
  }
  const idx = seen.indexOf(date);
  return idx >= 0 ? idx + 1 : 1;
};

// WhatsApp needs the country code; 10-digit Indian numbers get 91.
export const waNumber = (phone: string | undefined | null) => {
  const d = (phone ?? '').replace(/\D/g, '');
  return d.length === 10 ? `91${d}` : d;
};
