import type { SeasonalOrder } from '../../hooks/useSeasonalOrders';
import { packsByItem } from '../../lib/cart';

const NONE = new Map<string, number>();
// Worked out once per page load, so tiles keep their place while serving.
let frozen: Map<string, number> | null = null;

export const useSessionRank = (orders: SeasonalOrder[], loaded: boolean) => {
  if (loaded && !frozen) frozen = packsByItem(orders.flatMap(o => o.items));
  return frozen ?? NONE;
};
