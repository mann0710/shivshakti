import { useMemo } from 'react';
import { useMenuCategories, useMenuSubcategories, useMenuItemsFull } from '../../hooks/useMenuBuilder';
import { useSeasonalItems } from '../../hooks/useSeasonalItems';
import { useSeasonalOccasions } from '../../hooks/useSeasonalOccasions';
import { useHasTeamBin, usePackSchema } from '../../hooks/useSchemaStatus';
import { useCustomers } from '../../hooks/useCustomers';
import type { XCell, XSheet } from '../../lib/xlsx';
import type { Answers, Column, Plan, TileId } from '../../lib/importPlan';
import { DISH_COLUMNS, dishSheet, dishTemplate, planDishes } from '../../lib/importDishes';
import { SWEET_COLUMNS, planSweets, sweetSheet, sweetTemplate } from '../../lib/importSweets';
import { CUSTOMER_COLUMNS, customerSheet, customerTemplate, planCustomers } from '../../lib/importCustomers';
import { newId } from './saveImport';

// What each import kind is called, its columns, and today's data to plan against.

export type ImportKind = 'dishes' | 'sweets' | 'customers';

export interface KindInfo {
  tab: string;
  crumb: string;
  file: string;              // sheet and file name, e.g. "Menu"
  list: string;              // "Download current menu"
  today: string;             // "A copy of today's menu is kept"
  heads: [string, string, string];
  primary: string;           // detail shown without its label, e.g. "Price"
  tiles: Partial<Record<TileId, string>>;
  undo: string;
  columns: Column[];
  template: () => XCell[][];
  keys: string[][];
}

const COMMON: Partial<Record<TileId, string>> = { same: 'same as today', decide: 'need a decision' };

export const KINDS: Record<ImportKind, KindInfo> = {
  dishes: {
    tab: 'Dishes', crumb: 'Menu Builder', file: 'Menu', list: 'menu', today: 'menu', heads: ['Dish', 'Category › Subcategory', 'Price per plate'], primary: 'Price',
    tiles: { new: 'new dishes', changed: 'prices added or changed', ...COMMON, moved: 'moved to another course', other: 'other details changed' },
    undo: 'Menu import', columns: DISH_COLUMNS, template: dishTemplate, keys: [['menu_categories'], ['menu_subcategories'], ['menu_items_full']],
  },
  sweets: {
    tab: 'Sweets', crumb: 'Sweet items', file: 'Sweets', list: 'sweets', today: 'sweets list', heads: ['Sweet', 'Occasion', 'Price'], primary: 'Price',
    tiles: { new: 'new sweets', changed: 'prices added or changed', ...COMMON, other: 'other details changed' },
    undo: 'Sweets import', columns: SWEET_COLUMNS, template: sweetTemplate, keys: [['seasonal_items']],
  },
  customers: {
    tab: 'Customers', crumb: 'Customers', file: 'Customers', list: 'customers', today: 'customer list', heads: ['Name', 'Mobile', 'Details'], primary: '',
    tiles: { new: 'new customers', changed: 'details added or changed', ...COMMON },
    undo: 'Customer import', columns: CUSTOMER_COLUMNS, template: customerTemplate, keys: [['customers']],
  },
};
export const KIND_IDS = Object.keys(KINDS) as ImportKind[];

export interface Source { ready: boolean; failed: boolean; plan: (sheets: XSheet[], answers: Answers) => Plan; current: () => XCell[][] }

// Each kind loads only its own lists.
export function useDishSource(): Source {
  const cats = useMenuCategories();
  const subs = useMenuSubcategories();
  const dishes = useMenuItemsFull();
  const withStyles = useHasTeamBin();
  return useMemo(() => {
    const data = { cats: cats.data ?? [], subs: subs.data ?? [], dishes: dishes.data ?? [], withStyles };
    return {
      ready: !!(cats.data && subs.data && dishes.data), failed: cats.isError || subs.isError || dishes.isError,
      plan: (sheets, answers) => planDishes(sheets, data, answers, newId), current: () => dishSheet(data),
    };
  }, [cats.data, subs.data, dishes.data, withStyles, cats.isError, subs.isError, dishes.isError]);
}

export function useSweetSource(): Source {
  const items = useSeasonalItems();
  const occasions = useSeasonalOccasions();
  const schema = usePackSchema();
  return useMemo(() => {
    const data = { items: items.data ?? [], occasions: occasions.data ?? [], legacy: schema.data === 'legacy' };
    return {
      ready: !!(items.data && occasions.data && schema.data), failed: items.isError || occasions.isError || schema.isError,
      plan: (sheets, answers) => planSweets(sheets, data, answers, newId), current: () => sweetSheet(data),
    };
  }, [items.data, occasions.data, schema.data, items.isError, occasions.isError, schema.isError]);
}

export function useCustomerSource(): Source {
  const customers = useCustomers();
  return useMemo(() => {
    const list = customers.data ?? [];
    return {
      ready: !!customers.data, failed: customers.isError,
      plan: (sheets, answers) => planCustomers(sheets, list, answers, newId), current: () => customerSheet(list),
    };
  }, [customers.data, customers.isError]);
}
