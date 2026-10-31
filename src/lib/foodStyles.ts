// Food styles a dish suits; a booking's food type hides dishes that don't fit it.

export type FoodStyle = 'jain' | 'swaminarayan' | 'onion_garlic';

export const FOOD_STYLES: { id: FoodStyle; label: string; cls: string }[] = [
  { id: 'jain', label: 'Jain', cls: 'jain' },
  { id: 'swaminarayan', label: 'Swaminarayan', cls: 'swami' },
  { id: 'onion_garlic', label: 'Has onion / garlic', cls: 'onion' },
];

const LABEL = new Map(FOOD_STYLES.map(s => [s.id, s.label]));
const ORDER = FOOD_STYLES.map(s => s.id as string);

// Known styles only, in the usual order.
export const cleanStyles = (list?: string[] | null): FoodStyle[] =>
  ORDER.filter(id => (list ?? []).includes(id)) as FoodStyle[];

// "Jain · Swaminarayan", or "" when none is set.
export const stylesText = (list?: string[] | null) => cleanStyles(list).map(s => LABEL.get(s)).join(' · ');

// "Jain, Swaminarayan" typed in Excel or a sheet cell, in any case and order.
export function parseStyles(text: string): FoodStyle[] {
  const t = text.toLowerCase();
  const found = new Set<FoodStyle>();
  if (/\bjain\b/.test(t)) found.add('jain');
  if (/swami/.test(t)) found.add('swaminarayan');
  if (/onion|garlic|lasan|lehsun/.test(t)) found.add('onion_garlic');
  return cleanStyles(Array.from(found));
}
