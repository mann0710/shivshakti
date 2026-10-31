import type { SeasonalOrder, SeasonalOrderItem } from '../hooks/useSeasonalOrders';
import type { SeasonalPreorder } from '../hooks/useSeasonalPreorders';
import { baseName, nameKey } from './itemCatalog';
import { PriceUnit, formatLineSize, formatSize, roundMoney, unitFromLine } from './units';
import { ItemTotal, totalsByItem } from './cart';
import { isOpenPreorder } from './preorders';
import { billDue, billPaid, bookingDue, unpaidCount } from './dues';
import { billIn, bookingIn } from './occasions';

type Dated = Parameters<typeof billIn>[0];

const IST = 'Asia/Kolkata';
const sum = (list: number[]) => roundMoney(list.reduce((s, n) => s + n, 0));

export const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86400e3).toISOString().slice(0, 10);

// "4 Nov", "4 and 9 Nov", "30 Oct and 4 Nov", "4, 6 and 9 Nov"
export function datesShort(days: string[]): string {
  const month = (d: string) => new Date(`${d}T12:00:00+05:30`).toLocaleDateString('en-IN', { month: 'short', timeZone: IST });
  const sameMonth = days.every(d => d.slice(0, 7) === days[0]?.slice(0, 7));
  const parts = days.map((d, i) => (sameMonth && i < days.length - 1 ? String(Number(d.slice(8))) : `${Number(d.slice(8))} ${month(d)}`));
  return parts.length < 2 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

export interface MakeRow { key: string; name: string; unit: PriceUnit; byDate: Record<string, number>; total: number; packs: string }
export interface MakePlan { dates: string[]; rows: MakeRow[] }

// Sweets to make for booked (not yet packed) pre-bookings due from `today` for `days` days, by delivery day.
export function makePlan(preorders: SeasonalPreorder[], today: string, days = 10): MakePlan {
  const last = addDays(today, days - 1);
  const due = preorders.filter(p => (p.status === 'pending' || p.status === 'confirmed')
    && !!p.delivery_date && p.delivery_date >= today && p.delivery_date <= last);
  const rows = new Map<string, MakeRow & { sizes: Set<number>; qty: number }>();
  due.forEach(p => p.items.forEach(l => {
    const unit = unitFromLine(l.weight_unit);
    const key = `${nameKey(l.item_name)}|${unit}`;
    const r = rows.get(key) ?? { key, name: baseName(l.item_name), unit, byDate: {}, total: 0, packs: '', sizes: new Set<number>(), qty: 0 };
    const amount = l.weight * l.qty;
    r.byDate[p.delivery_date!] = (r.byDate[p.delivery_date!] ?? 0) + amount;
    r.total += amount;
    r.qty += l.qty;
    r.sizes.add(l.weight);
    rows.set(key, r);
  }));
  const list = Array.from(rows.values()).map(({ sizes, qty, ...r }) => {
    const size = sizes.size === 1 ? Array.from(sizes)[0] : 0;
    return { ...r, packs: size && qty > 1 ? `${qty} × ${formatSize(size, r.unit)}` : '' };
  }).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  const dates = Array.from(new Set(list.flatMap(r => Object.keys(r.byDate)))).sort();
  return { dates, rows: list };
}

export const amountText = (amount: number | undefined, unit: PriceUnit) => (amount ? formatSize(amount, unit) : '—');

// "Khajur Pak 56 × 250 g · Fancy Mix Mava 500 g"; one pack of each reads "A · B · C, 500 g each".
export function linesText(items: SeasonalOrderItem[]): string {
  const parts = items.map(l => ({ name: baseName(l.item_name), size: formatLineSize(l.weight, l.weight_unit), qty: l.qty }));
  if (parts.length > 1 && parts.every(p => p.qty === 1 && p.size === parts[0].size)) {
    return `${parts.map(p => p.name).join(' · ')}, ${parts[0].size} each`;
  }
  return parts.map(p => (p.qty > 1 ? `${p.name} ${p.qty} × ${p.size}` : `${p.name} ${p.size}`)).join(' · ');
}

const JUNK = /^(test\w*|data|demo|dummy|sample|abc|xyz|asdf|qwerty|na|none|x+|a+|[\W_]+)$/i;

// Names like "data" or "test 2" that someone typed while trying the POS.
export const looksLikeTest = (name: string) => {
  const n = name.replace(/["'`]/g, '').trim();
  return !n || JUNK.test(n) || /\btest\b/i.test(n);
};

// Open pre-bookings, soonest first; undated ones go last and test entries go after real ones on the same day.
export const dueList = (preorders: SeasonalPreorder[]) => preorders.filter(isOpenPreorder)
  .sort((a, b) => (a.delivery_date || '9').localeCompare(b.delivery_date || '9')
    || Number(looksLikeTest(a.customer_name)) - Number(looksLikeTest(b.customer_name))
    || a.customer_name.localeCompare(b.customer_name));

export interface DayTotal { count: number; total: number }

export interface Unpaid { total: number; count: number; first?: { name: string; billNo?: number | null } }

// Bills and handed-over bookings with money still to collect; the oldest one is named.
export function unpaidOf(orders: SeasonalOrder[], preorders: SeasonalPreorder[]): Unpaid {
  const bills = orders.filter(o => billDue(o) > 0).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const bookings = preorders.filter(p => bookingDue(p) > 0);
  const first = bills[0] ? { name: bills[0].customer_name, billNo: bills[0].bill_no } : bookings[0] ? { name: bookings[0].customer_name } : undefined;
  return { total: sum([...bills.map(billDue), ...bookings.map(bookingDue)]), count: unpaidCount(orders, preorders), first };
}

export interface Booked { total: number; count: number; advance: number }

export function bookedOf(preorders: SeasonalPreorder[]): Booked {
  const open = preorders.filter(isOpenPreorder);
  return { total: sum(open.map(p => p.total_amount)), count: open.length, advance: sum(open.map(p => p.advance_paid)) };
}

export interface SoFar { bills: DayTotal; bookings: DayTotal; collected: number; top: ItemTotal[] }

// The season's bills and pre-bookings, money received on them and the most asked sweets.
export function seasonSoFar(o: Dated, orders: SeasonalOrder[], preorders: SeasonalPreorder[]): SoFar {
  const bills = orders.filter(b => billIn(o, b));
  const bookings = preorders.filter(p => bookingIn(o, p));
  const lines = [...bills, ...bookings].flatMap(x => x.items);
  return {
    bills: { count: bills.length, total: sum(bills.map(b => b.total_amount)) },
    bookings: { count: bookings.length, total: sum(bookings.map(p => p.total_amount)) },
    collected: sum([...bills.map(billPaid), ...bookings.map(p => p.advance_paid)]),
    top: totalsByItem(lines, l => nameKey(l.item_name)).sort((a, b) => b.amount - a.amount).slice(0, 3),
  };
}
