import type { Booking, Menu, PriceTier } from '../types';
import { formatDateIST } from './ist';
import { inr } from './money';

// Package price by guest count: tiers sorted by their last guest count, the open-ended one last.
type Priced = Pick<Menu, 'price_per_plate' | 'price_tiers'>;
// One row of the tier editor; the last row is always "and more", so its `upto` is ignored.
export interface TierRow { upto: string; price: string }
export interface TierCheck { tiers: PriceTier[]; errors: string[]; error: string }

const DEFAULT_STEP = 150;
const whole = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s.trim()) : NaN);
const amount = (s: string) => parseFloat(String(s).replace(/[^\d.]/g, ''));
const key = (s: string) => s.trim().toLowerCase();

// Saved tiers with junk dropped; fewer than two ranges means one price.
export function cleanTiers(raw: unknown): PriceTier[] {
  if (!Array.isArray(raw)) return [];
  const list = raw
    .map(t => ({ upto: t?.upto == null ? null : Number(t.upto), price: Number(t?.price) }))
    .filter(t => t.price > 0 && (t.upto === null || (Number.isInteger(t.upto) && t.upto > 0)))
    .sort((a, b) => (a.upto ?? Infinity) - (b.upto ?? Infinity))
    .filter((t, i, all) => !i || t.upto !== all[i - 1].upto);
  return list.length > 1 ? list : [];
}

export const isTiered = (m: Priced) => cleanTiers(m.price_tiers).length > 1;

// First guest count of tier i.
const fromOf = (tiers: PriceTier[], i: number) => (i ? (tiers[i - 1].upto ?? 0) + 1 : 1);

// "Up to 150 guests", "151 – 300 guests", "301 guests and more"; `tight` gives "151–300" for one-line hints.
export function rangeLabel(tiers: PriceTier[], i: number, tight = false): string {
  const t = tiers[i];
  const from = fromOf(tiers, i);
  if (t.upto === null || i === tiers.length - 1) return `${from} guests and more`;
  return i === 0 ? `Up to ${t.upto} guests` : `${from}${tight ? '–' : ' – '}${t.upto} guests`;
}

// Tier for a guest count; none or zero guests fall in the first.
export const tierIndex = (tiers: PriceTier[], guests: number) => {
  const i = tiers.findIndex(t => t.upto === null || guests <= t.upto);
  return i < 0 ? tiers.length - 1 : i;
};

// Plate price for a guest count: the matching tier, else the one price.
export function priceAt(m: Priced, guests: number): number {
  const tiers = cleanTiers(m.price_tiers);
  return tiers.length ? tiers[tierIndex(tiers, guests)].price : Number(m.price_per_plate) || 0;
}

// Lowest and highest plate price, for the package list.
export function priceSpan(m: Priced): { low: number; high: number } {
  const prices = cleanTiers(m.price_tiers).map(t => t.price);
  const one = Number(m.price_per_plate) || 0;
  return prices.length ? { low: Math.min(...prices), high: Math.max(...prices) } : { low: one, high: one };
}

// A typed price still follows the package while it equals the package's price for that guest count.
export const followsPackage = (m: Priced, guests: number, price: number) => price > 0 && price === priceAt(m, guests);

// New plate price when the guest count moves; null leaves the price alone (typed by hand or unchanged).
export function followPrice(m: Priced, fromGuests: number, toGuests: number, price: number): number | null {
  if (!followsPackage(m, fromGuests, price)) return null;
  const next = priceAt(m, toGuests);
  return next !== price ? next : null;
}

// The range a guest count falls in, e.g. "151 – 300 guests"; empty for one price.
export function rangeAt(m: Priced, guests: number, tight = false): string {
  const tiers = cleanTiers(m.price_tiers);
  return tiers.length ? rangeLabel(tiers, tierIndex(tiers, guests), tight) : '';
}

// "₹250 a plate for 151–300 guests (Besic)"
export function tierHint(m: Priced & Pick<Menu, 'name'>, guests: number): string {
  const label = rangeAt(m, guests, true);
  return `${inr(priceAt(m, guests))} a plate${label ? ` for ${label.charAt(0).toLowerCase()}${label.slice(1)}` : ''} (${m.name})`;
}

// The tiered package a saved quote still follows: same price for its guests and the most dishes in common.
export function matchPackage<T extends Menu>(menus: T[], dishNames: string[], guests: number, price: number): T | undefined {
  const have = new Set(dishNames.map(key));
  const shared = (m: T) => (m.items ?? []).filter(n => have.has(key(n))).length;
  return menus
    .filter(m => isTiered(m) && followsPackage(m, guests, price) && shared(m) > 0)
    .sort((a, b) => shared(b) - shared(a))[0];
}

// Editor rows: to and from saved tiers.
export const toRows = (tiers: PriceTier[]): TierRow[] =>
  tiers.map((t, i) => ({ upto: t.upto === null || i === tiers.length - 1 ? '' : String(t.upto), price: String(t.price) }));

// Switching to "By number of guests": the current price up to 150 guests, then an open range to fill.
export const startRows = (price: string): TierRow[] => [{ upto: String(DEFAULT_STEP), price }, { upto: '', price: '' }];

// A new range goes just before the open-ended last one, one step past the previous limit.
export function addRange(rows: TierRow[]): TierRow[] {
  const limits = rows.slice(0, -1).map(r => whole(r.upto)).filter(n => n > 0);
  const last = limits[limits.length - 1] ?? 0;
  const step = limits.length > 1 ? last - limits[limits.length - 2] : last || DEFAULT_STEP;
  const added = { upto: String(last + (step > 0 ? step : DEFAULT_STEP)), price: '' };
  return rows.length ? [...rows.slice(0, -1), added, rows[rows.length - 1]] : startRows('');
}

// Removing the last row leaves the one before it open-ended.
export const dropRange = (rows: TierRow[], i: number): TierRow[] => {
  const next = rows.filter((_, j) => j !== i);
  return next.map((r, j) => (j === next.length - 1 ? { ...r, upto: '' } : r));
};

// First guest count of row i while editing; null when the row before has no valid limit yet.
export const rowFrom = (rows: TierRow[], i: number): number | null => {
  if (!i) return 1;
  const prev = whole(rows[i - 1].upto);
  return prev > 0 ? prev + 1 : null;
};

// Row i's range while editing, e.g. "151 – 300 guests"; "…" stands for a limit not typed yet.
export function rowLabel(rows: TierRow[], i: number): string {
  const from = rowFrom(rows, i) ?? '…';
  if (i === rows.length - 1) return `${from} guests and more`;
  const upto = whole(rows[i].upto) > 0 ? whole(rows[i].upto) : '…';
  return i ? `${from} – ${upto} guests` : `Up to ${upto} guests`;
}

export const PRICE_MISSING = 'Type the price per plate';

// Rows to tiers with one message per row: ascending limits, prices above zero, the last range open-ended.
export function checkTiers(rows: TierRow[]): TierCheck {
  const errors = rows.map(() => '');
  const tiers: PriceTier[] = rows.map((r, i) => ({ upto: i === rows.length - 1 ? null : whole(r.upto), price: amount(r.price) }));
  tiers.forEach((t, i) => {
    const prev = i ? tiers[i - 1].upto : 0;
    if (t.upto !== null && !(t.upto > 0)) errors[i] = 'Type the last guest count of this range';
    else if (t.upto !== null && prev !== null && prev > 0 && t.upto <= prev) errors[i] = `Must be more than ${prev} guests`;
    else if (!(t.price > 0)) errors[i] = PRICE_MISSING;
  });
  const error = rows.length < 2 ? 'Add a second guest range, or pick One price' : errors.find(Boolean) ?? '';
  return { tiers, errors, error };
}

export interface Sample { guests: number; name?: string; date?: string }

// An upcoming booking to show the price on: one already on this package first, then the soonest.
export function sampleBooking(bookings: Pick<Booking, 'guest_count' | 'event_date' | 'status' | 'menu_id' | 'customer'>[], menuId: string | undefined, today: string, fallback = 100): Sample {
  const mine = (b: { menu_id?: string | null }) => Number(!!menuId && b.menu_id === menuId);
  const next = bookings
    .filter(b => b.guest_count > 0 && b.event_date >= today && b.status !== 'cancelled' && b.status !== 'completed')
    .sort((a, b) => mine(b) - mine(a) || a.event_date.localeCompare(b.event_date))[0];
  return next ? { guests: next.guest_count, name: next.customer?.name?.trim() || undefined, date: next.event_date } : { guests: fallback };
}

// "(Kavit Mangrolya, 25 Nov)" after the guest count; empty for the sample count.
export const sampleWho = (s: Sample) => (s.name || s.date ? `(${[s.name, s.date && formatDateIST(s.date, 'd MMM')].filter(Boolean).join(', ')})` : '');

// "· Kavit, 140 guests" on the matching tier row.
export const sampleBadge = (s: Sample) => `· ${s.name ? `${s.name.split(/\s+/)[0]}, ` : ''}${s.guests} guests`;
