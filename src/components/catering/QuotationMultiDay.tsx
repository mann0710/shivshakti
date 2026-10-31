import React, { useState } from 'react';
import { EventDay, MealSlot, QuotationLineItem } from '../../hooks/useQuotations';
import { getDayNumber } from '../../lib/quoteMath';
import { basePlate, ownRange, typedPrice } from '../../lib/quoteChoices';
import { genId, PickerItem } from '../../lib/quoteLines';
import { range } from '../../lib/quoteSummary';
import { formatDateIST } from '../../lib/ist';
import { inr } from '../../lib/money';
import MenuCourses from '../quotes/MenuCourses';
import { Field } from '../quotes/bits';
import { useConfirm } from '../ui/ConfirmDialog';

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Hi-Tea', 'Snacks', 'Dinner', 'Supper'];

interface Props {
  eventDays: EventDay[];
  setEventDays: React.Dispatch<React.SetStateAction<EventDay[]>>;
  guestCount: number;
  defaultDate: string;
  menuItems: PickerItem[];
  toLine: (it: PickerItem) => QuotationLineItem;
  showPrices: boolean;
  who: string;
}

const sumMeals = (meals: MealSlot[]) => meals.reduce((s, m) => s + m.subtotal, 0);

// A meal price is for its menu as listed; open alternatives give a range around it.
const priceMeal = (m: MealSlot, items: QuotationLineItem[], price: number): MealSlot => {
  const p = ownRange(price, items);
  return { ...m, items, per_plate_amount: p.low, per_plate_max: p.high, subtotal: p.low * m.guest_count };
};
const typedOf = (m: MealSlot) => typedPrice(m.per_plate_amount, m.per_plate_max, m.items ?? []);

// Dish changes keep a typed meal price; otherwise the meal adds up its dish prices.
const withItems = (m: MealSlot, items: QuotationLineItem[]): MealSlot => {
  const own = typedOf(m) > 0 && typedOf(m) !== basePlate(m.items ?? []);
  return priceMeal(m, items, !items.length ? 0 : own ? typedOf(m) : basePlate(items));
};
const nextDate = (iso: string) => {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

// Several meals or days: one tab per day, a card per meal with its time, guests, rate and dishes.
const QuotationMultiDay: React.FC<Props> = ({ eventDays, setEventDays, guestCount, defaultDate, menuItems, toLine, showPrices, who }) => {
  const [dayIdx, setDayIdx] = useState(0);
  const { confirm, dialog } = useConfirm();
  const at = Math.min(dayIdx, Math.max(0, eventDays.length - 1));
  const day = eventDays[at];

  const patchDay = (idx: number, fn: (meals: MealSlot[]) => MealSlot[]) =>
    setEventDays(prev => prev.map((d, i) => {
      if (i !== idx) return d;
      const meals = fn(d.meals);
      return { ...d, meals, day_subtotal: sumMeals(meals) };
    }));
  const patchMeal = (idx: number, id: string, fn: (m: MealSlot) => MealSlot) => patchDay(idx, meals => meals.map(m => (m.id === id ? fn(m) : m)));
  const setField = (idx: number, id: string, field: keyof MealSlot, value: string | number) => patchMeal(idx, id, m => {
    if (field === 'per_plate_amount') return priceMeal(m, m.items ?? [], Number(value));
    const u = { ...m, [field]: value };
    return { ...u, subtotal: u.per_plate_amount * u.guest_count };
  });

  const addDay = () => {
    const last = eventDays[eventDays.length - 1]?.date || defaultDate;
    setEventDays(prev => [...prev, { day_number: prev.length + 1, date: prev.length ? nextDate(last) : last, meals: [], day_subtotal: 0 }]);
    setDayIdx(eventDays.length);
  };
  // A day with meals can't come back once it is saved, so ask.
  const removeDay = async (idx: number) => {
    const n = eventDays[idx]?.meals.length ?? 0;
    if (n && !(await confirm({ title: 'Remove this day?', message: `Its ${n} meal${n > 1 ? 's' : ''} and their dishes are removed.`, confirmLabel: 'Remove', danger: true }))) return;
    setEventDays(prev => prev.filter((_, i) => i !== idx));
    setDayIdx(0);
  };
  const addMeal = (idx: number) => patchDay(idx, meals => [...meals, {
    id: genId(), meal_type: 'lunch', ceremony_name: '', time: '', guest_count: guestCount, per_plate_amount: 0, discount_amount: 0, items: [], subtotal: 0,
  }]);
  const copyMeal = (idx: number, m: MealSlot) => patchDay(idx, meals => {
    const i = meals.findIndex(x => x.id === m.id);
    return [...meals.slice(0, i + 1), { ...m, id: genId(), items: m.items.map(it => ({ ...it })) }, ...meals.slice(i + 1)];
  });
  const moveMeal = (from: number, to: number, m: MealSlot) => setEventDays(prev => prev.map((d, i) => {
    const meals = i === from ? d.meals.filter(x => x.id !== m.id) : i === to ? [...d.meals, m] : d.meals;
    return { ...d, meals, day_subtotal: sumMeals(meals) };
  }));

  const meal = (m: MealSlot) => {
    const rate = m.discount_amount > 0 && m.discount_amount < m.per_plate_amount ? m.discount_amount : m.per_plate_amount;
    const hi = m.per_plate_max != null && m.per_plate_max > m.per_plate_amount ? m.per_plate_max * m.guest_count : null;
    return (
      <div key={m.id} className="q-meal">
        <div className="q-meal-row">
          <Field label="Meal">
            <select value={m.meal_type} onChange={e => setField(at, m.id, 'meal_type', e.target.value)}>
              {MEAL_TYPES.map(t => <option key={t} value={t.toLowerCase()}>{t}</option>)}
            </select>
          </Field>
          <Field label="Time"><input type="time" value={m.time} onChange={e => setField(at, m.id, 'time', e.target.value)} /></Field>
          <Field label="Guests"><input type="number" min={0} inputMode="numeric" value={m.guest_count || ''} placeholder="0" onChange={e => setField(at, m.id, 'guest_count', parseInt(e.target.value, 10) || 0)} /></Field>
          <Field label="A plate"><input type="number" min={0} inputMode="decimal" value={typedOf(m) || ''} placeholder="₹" onChange={e => setField(at, m.id, 'per_plate_amount', parseFloat(e.target.value) || 0)} /></Field>
          <button type="button" className="q-x" aria-label={`Remove ${m.meal_type}`} onClick={() => patchDay(at, meals => meals.filter(x => x.id !== m.id))}>×</button>
        </div>
        <MenuCourses compact items={m.items ?? []} menu={menuItems} showPrices={showPrices} who={who} toLine={toLine}
          preview={next => { const p = withItems(m, next); return `${range(p.per_plate_amount, p.per_plate_max)} a plate`; }}
          onChange={next => patchMeal(at, m.id, x => withItems(x, next))} />
        <div className="q-meal-foot">
          <span>{m.guest_count} × {inr(rate)}{rate !== m.per_plate_amount ? ` (offer, was ${inr(m.per_plate_amount)})` : ''}</span>
          <b>{range(rate * m.guest_count, hi)}</b>
        </div>
        <details className="q-more">
          <summary>More for this meal</summary>
          <div className="q-fields">
            <Field label="Ceremony name"><input value={m.ceremony_name || ''} placeholder="e.g. Haldi" onChange={e => setField(at, m.id, 'ceremony_name', e.target.value)} /></Field>
            <Field label="Offer price a plate" hint="Shown struck through beside the plate price"><input type="number" min={0} inputMode="decimal" value={m.discount_amount || ''} placeholder="Same" onChange={e => setField(at, m.id, 'discount_amount', parseFloat(e.target.value) || 0)} /></Field>
          </div>
          <div className="q-chips">
            <button type="button" className="q-mini" onClick={() => copyMeal(at, m)}>Copy this meal</button>
            {eventDays.map((d, i) => i !== at && <button key={i} type="button" className="q-mini" onClick={() => moveMeal(at, i, m)}>Move to Day {getDayNumber(d.date, eventDays)}</button>)}
          </div>
        </details>
      </div>
    );
  };

  return (
    <>
      <div className="q-days" role="tablist" aria-label="Days">
        {eventDays.map((d, i) => (
          <button key={i} type="button" role="tab" aria-selected={i === at} className={`q-otab${i === at ? ' on' : ''}`} onClick={() => setDayIdx(i)}>
            <b>Day {getDayNumber(d.date, eventDays)}</b>{d.date ? ` · ${formatDateIST(d.date, 'EEE d MMM')}` : ''}
          </button>
        ))}
        <button type="button" className="q-otab add" onClick={addDay}>+ Add a day</button>
      </div>
      {day && <>
        <div className="q-dayline">
          <Field label="Date of this day"><input type="date" value={day.date} onChange={e => setEventDays(prev => prev.map((d, i) => (i === at ? { ...d, date: e.target.value } : d)))} /></Field>
          {eventDays.length > 1 && <button type="button" className="q-link danger" onClick={() => removeDay(at)}>Remove this day</button>}
        </div>
        {day.meals.map(meal)}
        {!day.meals.length && <p className="q-hint">No meals on this day yet.</p>}
        <button type="button" className="q-otab add" onClick={() => addMeal(at)}>+ Add a meal to Day {getDayNumber(day.date, eventDays)}</button>
      </>}
      {dialog}
    </>
  );
};

export default QuotationMultiDay;
