import { useMemo } from 'react';
import { Quotation } from './useQuotations';
import { MenuItem } from './useMenuBuilder';

// Price for a menu item in a new quote: Menu Builder price first, else the last quoted price.
export const useItemPrices = (menuItems: MenuItem[], quotations: Quotation[]) => {
  const lastPrices = useMemo(() => {
    const map = new Map<string, number>();
    [...quotations].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).forEach(q =>
      [...(q.items || []), ...(q.event_days || []).flatMap(d => (d.meals || []).flatMap(m => m.items || []))]
        .forEach(it => { if (it.amount > 0 && !map.has(it.item_id)) map.set(it.item_id, it.amount); }));
    return map;
  }, [quotations]);
  const savedPrices = useMemo(() => new Map(menuItems.map(it => [it.id, it.default_price || 0])), [menuItems]);
  return (itemId: string) => savedPrices.get(itemId) || lastPrices.get(itemId) || 0;
};
