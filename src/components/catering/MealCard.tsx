import React from 'react';
import { MealSlot, QuotationLineItem } from '../../hooks/useQuotations';
import { isOnePrice, mealGap, priceMeal, setMealOnePrice, typedOf, withItems, hasDishPrices, showsDishPrices, plateOff, menuValueOf, showsDiscount, isRanged } from '../../lib/mealPrice';
import { PickerItem } from '../../lib/quoteLines';
import { basePlate } from '../../lib/quoteChoices';
import { range } from '../../lib/quoteSummary';
import { inr } from '../../lib/money';
import MenuCourses from '../quotes/MenuCourses';
import PlateBlock, { PlateModel } from '../quotes/PlateBlock';
import { Field } from '../quotes/bits';

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Hi-Tea', 'Snacks', 'Dinner', 'Supper'];

interface Props {
  m: MealSlot;
  label: string;                                  // "Day 1 dinner", for screen readers
  menuItems: PickerItem[];
  toLine: (it: PickerItem) => QuotationLineItem;
  showPrices: boolean;
  pdfPrices: boolean;                             // the quote-wide "Show each dish's price"
  who: string;
  onChange: (fn: (m: MealSlot) => MealSlot) => void;
  onRemove: () => void;
  onCopy: () => void;
  moves: { label: string; go: () => void }[];
  onOneMeal?: () => void;                         // offered when this is the quote's only meal
  onSource: (kind: 'package' | 'copy') => void;   // start this meal from a package or another quote's menu
}

// Turning the discount on with no dish prices printed keeps the dish total as the list price, so the PDF can show it.
export const withDiscount = (x: MealSlot, on: boolean, dishPrices: boolean): MealSlot => (on
  ? { ...x, hide_discount: undefined, full_price: Number(x.full_price) > 0 || dishPrices ? x.full_price : menuValueOf({ ...x, full_price: null }) }
  : { ...x, hide_discount: true });

// The plate block's view of one meal.
export const mealPlate = (m: MealSlot, onChange: Props['onChange'], showPrices: boolean, pdfPrices: boolean): PlateModel => {
  const priced = hasDishPrices(m);
  const dishOn = pdfPrices && priced && showsDishPrices(m);
  return {
    id: m.id, menuValue: menuValueOf(m), listPrice: Number(m.full_price) > 0, typed: typedOf(m), follows: !Number(m.full_price) && typedOf(m) === basePlate(m.items),
    onPrice: v => onChange(x => priceMeal(x, x.items ?? [], v ?? menuValueOf(x))),
    low: m.per_plate_amount, high: isRanged(m) ? m.per_plate_max ?? null : null, guests: m.guest_count,
    gap: mealGap(m), onePrice: isOnePrice(m), onOnePrice: on => onChange(x => setMealOnePrice(x, on)),
    off: plateOff(m),
    discount: { on: showsDiscount(m, dishOn), set: on => onChange(x => withDiscount(x, on, dishOn)) },
    dishPrices: showPrices ? { on: priced && showsDishPrices(m), can: priced, set: on => onChange(x => ({ ...x, hide_prices: !on || undefined })) } : undefined,
  };
};

// One meal of a several-meal quote: type, time, guests, dishes, price a plate and More.
const MealCard: React.FC<Props> = ({ m, label, menuItems, toLine, showPrices, pdfPrices, who, onChange, onRemove, onCopy, moves, onOneMeal, onSource }) => {
  const set = (field: keyof MealSlot, value: string | number) => onChange(x => {
    const u = { ...x, [field]: value };
    return { ...u, subtotal: u.per_plate_amount * u.guest_count };
  });
  const offer = m.discount_amount > 0 && m.discount_amount < m.per_plate_amount ? m.discount_amount : 0;
  return (
    <div className="q-meal">
      <div className="q-meal-row">
        <Field label="Meal">
          <select value={m.meal_type} onChange={e => set('meal_type', e.target.value)}>
            {MEAL_TYPES.map(t => <option key={t} value={t.toLowerCase()}>{t}</option>)}
          </select>
        </Field>
        <Field label="Time"><input type="time" value={m.time} onChange={e => set('time', e.target.value)} /></Field>
        <Field label="Guests"><input type="number" min={0} inputMode="numeric" value={m.guest_count || ''} placeholder="0" onChange={e => set('guest_count', parseInt(e.target.value, 10) || 0)} /></Field>
        <button type="button" className="q-x" aria-label={`Remove ${label}`} onClick={onRemove}>×</button>
      </div>
      <span className="q-chips">
        <button type="button" className="q-mini" onClick={() => onSource('package')}>Start from a package</button>
        <button type="button" className="q-mini" onClick={() => onSource('copy')}>Copy from another quote</button>
      </span>
      <MenuCourses compact items={m.items ?? []} menu={menuItems} showPrices={showPrices} who={who} toLine={toLine}
        preview={next => { const p = withItems(m, next); return `${range(p.per_plate_amount, p.per_plate_max)} a plate`; }}
        onChange={next => onChange(x => withItems(x, next))} />
      <PlateBlock p={mealPlate(m, onChange, showPrices, pdfPrices)} />
      {offer > 0 && <p className="q-hint">Older offer price {inr(offer)} a plate applies (was {inr(m.per_plate_amount)}): {inr(offer * m.guest_count)} for this meal. Change it under More.</p>}
      <details className="q-more">
        <summary>More for this meal · list price, ceremony, copy or move</summary>
        <div className="q-fields">
          <Field label="Ceremony name"><input value={m.ceremony_name || ''} placeholder="e.g. Haldi" onChange={e => set('ceremony_name', e.target.value)} /></Field>
          <Field label="List price a plate" hint="Instead of what the dishes add up to. The PDF strikes this price through, so use a real price.">
            <input type="number" min={0} inputMode="decimal" value={m.full_price || ''} placeholder={`Dishes: ₹${menuValueOf({ ...m, full_price: null })}`} onChange={e => set('full_price', parseFloat(e.target.value) || 0)} />
          </Field>
          {m.discount_amount > 0 && <Field label="Offer price a plate" hint="Older way to discount; clear it and use Your price instead"><input type="number" min={0} inputMode="decimal" value={m.discount_amount || ''} placeholder="Same" onChange={e => set('discount_amount', parseFloat(e.target.value) || 0)} /></Field>}
        </div>
        <div className="q-chips">
          <button type="button" className="q-mini" onClick={onCopy}>Copy this meal</button>
          {moves.map(x => <button key={x.label} type="button" className="q-mini" onClick={x.go}>{x.label}</button>)}
          {onOneMeal && <button type="button" className="q-mini" onClick={onOneMeal}>Make it a one-meal quote</button>}
        </div>
      </details>
    </div>
  );
};

export default MealCard;
