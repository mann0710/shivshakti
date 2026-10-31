import { istDay } from './preorders';

type Dated = { id: string; name: string; is_active: boolean; start_date?: string | null; end_date?: string | null };
type BillLike = { created_at: string; occasion_id?: string | null; cancelled_at?: string | null };
type BookingLike = { created_at: string; delivery_date?: string | null; occasion_id?: string | null; status: string };

const IST = 'Asia/Kolkata';
const noon = (day: string) => new Date(`${day}T12:00:00+05:30`);

export const hasDates = (o: Dated) => !!o.start_date && !!o.end_date;
export const inDates = (o: Dated, day: string) => hasDates(o) && o.start_date! <= day && day <= o.end_date!;

// The active occasion whose dates include `day` (YYYY-MM-DD); the shortest season wins if they overlap.
export function occasionOn<T extends Dated>(occasions: T[], day: string): T | undefined {
  const span = (o: T) => Date.parse(o.end_date!) - Date.parse(o.start_date!);
  return occasions.filter(o => o.is_active && inDates(o, day)).sort((a, b) => span(a) - span(b))[0];
}

// The soonest occasion that starts after `day`.
export const nextOccasion = <T extends Dated>(occasions: T[], day: string): T | undefined =>
  occasions.filter(o => hasDates(o) && o.start_date! > day).sort((a, b) => a.start_date!.localeCompare(b.start_date!))[0];

// "25 Oct – 8 Nov" for the list; empty when dates are not set.
export const datesText = (o: Dated) => {
  if (!o.start_date || !o.end_date) return '';
  const f = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return `${f(o.start_date)} – ${f(o.end_date)}`;
};

// "Sun 8 Nov"
export const dayName = (day: string) => {
  const d = noon(day);
  return `${d.toLocaleDateString('en-IN', { weekday: 'short', timeZone: IST })} ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: IST })}`;
};

export const daysBetween = (from: string, to: string) => Math.round((noon(to).getTime() - noon(from).getTime()) / 86400e3);

export const awayText = (n: number) => (n <= 0 ? 'today' : n === 1 ? 'tomorrow' : `${n} days away`);

// The festival day is the last day of the season.
export const mainDay = (o: Dated) => o.end_date ?? null;

// "Diwali 2026": the name with its season's year, unless the name already has one.
export const seasonTitle = (o: Dated) => (o.end_date && !/\b\d{4}\b/.test(o.name) ? `${o.name} ${o.end_date.slice(0, 4)}` : o.name);

// A bill counts for an occasion when made within its dates, or when tagged with it if no dates are set.
export const billIn = (o: Dated, b: BillLike) =>
  !b.cancelled_at && (hasDates(o) ? inDates(o, istDay(b.created_at)) : b.occasion_id === o.id);

// A pre-booking counts by its delivery day (or booking day), or by its tag if no dates are set.
export const bookingIn = (o: Dated, p: BookingLike) =>
  p.status !== 'cancelled' && (hasDates(o) ? inDates(o, p.delivery_date || istDay(p.created_at)) : p.occasion_id === o.id);

export interface SeasonCount { bills: number; bookings: number }

export const seasonCount = (o: Dated, bills: BillLike[], bookings: BookingLike[]): SeasonCount => ({
  bills: bills.filter(b => billIn(o, b)).length,
  bookings: bookings.filter(p => bookingIn(o, p)).length,
});

export type DatesCheck = { ok: true } | { ok: false; error: string };

// Both dates or neither, and the end not before the start.
export function checkDates(from: string, to: string): DatesCheck {
  if (!from && !to) return { ok: true };
  if (!from || !to) return { ok: false, error: 'Pick both dates, or leave both empty' };
  if (to < from) return { ok: false, error: 'The last day is before the first day' };
  return { ok: true };
}

export interface Banner { badge: string; title: string; text: string; short: string }

const soon = (name: string, n: number) => (n <= 0 ? `${name} today` : n === 1 ? `${name} tomorrow` : `${name} in ${n} days`);

// What the season strip on Sweets today says, from the occasions' dates.
export function seasonBanner<T extends Dated>(occasions: T[], today: string): Banner {
  const now = occasionOn(occasions, today);
  if (now) {
    const day = now.end_date!;
    const n = daysBetween(today, day);
    const also = occasions.filter(o => o.id !== now.id && o.end_date && o.end_date >= today && inDates(now, o.end_date))
      .map(o => `${o.name} is ${dayName(o.end_date!)}.`);
    return {
      badge: String(n),
      title: `${now.name} season · ${now.name} is ${n > 0 ? `${dayName(day)}, ${awayText(n)}` : `today, ${dayName(day)}`}`,
      text: [`Bills and pre-bookings dated ${datesText(now)} count for "${seasonTitle(now)}".`, ...also].join(' '),
      short: soon(now.name, n),
    };
  }
  const loose = occasions.find(o => o.is_active && !hasDates(o));
  if (loose) {
    return { badge: '', title: `${loose.name} is on the counter · dates not set`, text: `Set its dates on Occasions so bills and pre-bookings count for ${loose.name}.`, short: `${loose.name} on` };
  }
  const next = nextOccasion(occasions, today);
  if (next) {
    const n = daysBetween(today, next.start_date!);
    return {
      badge: String(n),
      title: `No season today · ${next.name} starts ${dayName(next.start_date!)}, ${awayText(n)}`,
      text: next.is_active ? `${next.name} sweets are already on the counter.` : 'Start the season when you are ready to sell its sweets.',
      short: soon(next.name, daysBetween(today, next.end_date!)),
    };
  }
  return { badge: '', title: 'No season on the counter', text: 'Only all-year sweets are on sale. Give an occasion its dates to plan for it.', short: 'no season' };
}

// The line under an occasion's name: on the counter or not, and when its festival is.
export function occasionState(o: Dated, today: string): string {
  if (!o.is_active) return 'Off — sweets hidden from the POS';
  if (!hasDates(o)) return 'On the counter · dates not set';
  if (inDates(o, today)) return `On the counter now · ${o.name} is ${dayName(o.end_date!)}`;
  return o.start_date! > today ? `On the counter · season starts ${dayName(o.start_date!)}` : `On the counter · season ended ${dayName(o.end_date!)}`;
}
