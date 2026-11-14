import type { EventDay, MealSlot, QuotationLineItem } from '../hooks/useQuotations';
import { basePlate, listedForTop, onePickPrice, ownRange, pickRange, setPickPrices, typedPrice } from './quoteChoices';
import { getDayNumber } from './quoteMath';

// Meal prices on multi-day quotes: one price for any pick, ranges left open, dish prices on the PDF.

export const sumMeals = (meals: MealSlot[]) => meals.reduce((s, m) => s + m.subtotal, 0);

// A meal price is for its menu as listed; open alternatives give a range around it.
export const priceMeal = (m: MealSlot, items: QuotationLineItem[], price: number): MealSlot => {
  const p = ownRange(price, items);
  return { ...m, items, per_plate_amount: p.low, per_plate_max: p.high, subtotal: p.low * m.guest_count };
};
export const typedOf = (m: MealSlot) => typedPrice(m.per_plate_amount, m.per_plate_max, m.items ?? []);

// Dish changes keep a typed meal price; otherwise the meal adds up its dish prices.
export const withItems = (m: MealSlot, items: QuotationLineItem[]): MealSlot => {
  const own = typedOf(m) > 0 && typedOf(m) !== basePlate(m.items ?? []);
  return priceMeal(m, items, !items.length ? 0 : own ? typedOf(m) : basePlate(items));
};

// The plate range the meal's picks would make; null when they never move its price.
export const mealGap = (m: MealSlot) => pickRange(m.items);
export const isOnePrice = (m: MealSlot) => onePickPrice(m.items);
export const isRanged = (m: MealSlot) => m.per_plate_max != null && m.per_plate_max > m.per_plate_amount;

// Same price whatever they choose (the top of the range), or let the pick move it again.
export const setMealOnePrice = (m: MealSlot, one: boolean): MealSlot => {
  const items = setPickPrices(m.items ?? [], one);
  return priceMeal(m, items, one ? m.per_plate_max ?? m.per_plate_amount : listedForTop(m.per_plate_amount, items));
};

// Meals whose price still depends on the pick, with their day number.
export const rangedMeals = (days: EventDay[]) =>
  days.flatMap(d => d.meals.filter(isRanged).map(meal => ({ meal, day: getDayNumber(d.date, days) })));

// Every ranged meal at one price; days keep their totals in step.
export const oneEveryMeal = (days: EventDay[]): EventDay[] => days.map(d => {
  const meals = d.meals.map(m => (isRanged(m) ? setMealOnePrice(m, true) : m));
  return { ...d, meals, day_subtotal: sumMeals(meals) };
});

export const hasDishPrices = (m: MealSlot) => (m.items ?? []).some(i => (Number(i.amount) || 0) > 0);
// Dish prices print for a meal unless turned off on it.
export const showsDishPrices = (m: MealSlot) => !m.hide_prices;
