import type { SeasonalOrder, SeasonalOrderItem } from '../../hooks/useSeasonalOrders';
import type { SeasonalPreorder } from '../../hooks/useSeasonalPreorders';
import type { SeasonalOccasion } from '../../hooks/useSeasonalOccasions';
import type { SeasonalItem } from '../itemCatalog';
import type { Booking, Invoice, Payment } from '../../types';
import { nameKey } from '../itemCatalog';
import { handedOverOn, istDay } from '../preorders';
import { billDue, isCancelled } from '../dues';
import { Range, inRange } from './model';

// Everything a report may need; each builder picks what it uses.
export interface ReportInput {
  range: Range;
  today: string;
  occasionId: string;            // '' = all occasions
  orders: SeasonalOrder[];       // bills made in the range, plus older ones paid in it
  unpaidOrders: SeasonalOrder[]; // every bill with money due, any date
  preorders: SeasonalPreorder[]; // all pre-bookings
  items: SeasonalItem[];
  occasions: SeasonalOccasion[];
  bookings: Booking[];
  invoices: Invoice[];
  payments: Payment[];           // catering payments dated in the range
  bookingValue: (b: Booking) => number;
}

export const UNCATEGORISED = 'Uncategorised';

const byOccasion = (inp: ReportInput) => <T extends { occasion_id?: string }>(list: T[]) =>
  inp.occasionId ? list.filter(x => x.occasion_id === inp.occasionId) : list;

// Bills made in the range; cancelled ones keep their number but are not sales.
export const billsIn = (inp: ReportInput) => byOccasion(inp)(inp.orders.filter(o => !isCancelled(o) && inRange(istDay(o.created_at), inp.range)));
export const preordersOf = (inp: ReportInput) => byOccasion(inp)(inp.preorders);
export const ordersOf = (inp: ReportInput) => byOccasion(inp)(inp.orders);
export const unpaidOf = (inp: ReportInput) => byOccasion(inp)(inp.unpaidOrders.filter(o => billDue(o) > 0));

// Pre-bookings count as sales on the day they are handed over.
export const handedOverIn = (inp: ReportInput) => preordersOf(inp).filter(p => inRange(handedOverOn(p), inp.range));

export const soldLines = (inp: ReportInput): SeasonalOrderItem[] =>
  [...billsIn(inp), ...handedOverIn(inp)].flatMap(o => o.items);

export const occasionName = (inp: ReportInput, id?: string) => inp.occasions.find(o => o.id === id)?.name ?? 'No occasion';

// Category from the item itself, else from an item with the same base name.
export function categoryOf(inp: ReportInput): (l: SeasonalOrderItem) => string {
  const byId = new Map(inp.items.map(i => [i.id, i.category]));
  const byName = new Map(inp.items.filter(i => i.category).map(i => [nameKey(i.name), i.category]));
  return l => byId.get(l.item_id) || byName.get(nameKey(l.item_name)) || UNCATEGORISED;
}

export const occasionNote = (inp: ReportInput) => (inp.occasionId ? ` · ${occasionName(inp, inp.occasionId)} only` : '');
