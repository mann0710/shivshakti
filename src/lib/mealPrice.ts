import type { EventDay, MealSlot, QuotationLineItem } from '../hooks/useQuotations';
import { basePlate, listedForTop, onePickPrice, ownRange, pickRange, setPickPrices, typedPrice } from './quoteChoices';
import { getDayNumber, keepPlateOff } from './quoteMath';

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
  const p = priceMeal(m, items, one ? m.per_plate_max ?? m.per_plate_amount : listedForTop(m.per_plate_amount, items));
  return { ...p, full_price: keepPlateOff(m.full_price, m.per_plate_amount, p.per_plate_amount) };
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

// Plate discount: a full price above what they pay; printed unless turned off. An older offer price wins.
export interface Plate { full_price?: number | null; per_plate_amount: number; per_plate_max?: number | null; hide_discount?: boolean; guest_count?: number; discount_amount?: number }
export const plateOff = (m: Plate) =>
  (Number(m.discount_amount) > 0 ? 0 : Math.max(0, (Number(m.full_price) || 0) - (Number(m.per_plate_amount) || 0)));
export const showsDiscount = (m: Plate) => plateOff(m) > 0 && !m.hide_discount;
export const discountSaving = (m: Plate) => (showsDiscount(m) ? plateOff(m) * (m.guest_count || 0) : 0);
// A one-meal quote as a plate; its discount_amount is the quote's discounts, not an offer price.
export const quotePlate = (q: Plate, guests: number): Plate => ({ ...q, discount_amount: 0, guest_count: guests });
// A "before discount" price typed below the plate price means the two were entered the other way round.
export const swapLower = (m: MealSlot): MealSlot => {
  const full = Number(m.full_price) || 0;
  const typed = typedOf(m);
  return full > 0 && full < typed ? { ...priceMeal(m, m.items ?? [], full), full_price: typed } : m;
};
