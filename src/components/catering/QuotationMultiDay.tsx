import React, { useState } from 'react';
import { EventDay, MealSlot, Quotation, QuotationLineItem } from '../../hooks/useQuotations';
import { getDayNumber } from '../../lib/quoteMath';
import { sumMeals } from '../../lib/mealPrice';
import { formatDateIST } from '../../lib/ist';
import MealCard from './MealCard';
import toast from 'react-hot-toast';
import { PackageDialog, CopyDialog } from '../quotes/MenuSources';
import { priceAt } from '../../lib/priceTiers';
import { genId, mergeLines, PickerItem } from '../../lib/quoteLines';
import { priceMeal, withItems } from '../../lib/mealPrice';
import { Field } from '../quotes/bits';
import { useConfirm } from '../ui/ConfirmDialog';

interface Props {
  eventDays: EventDay[];
  setEventDays: React.Dispatch<React.SetStateAction<EventDay[]>>;
  guestCount: number;
  defaultDate: string;
  menuItems: PickerItem[];
  toLine: (it: PickerItem) => QuotationLineItem;
  showPrices: boolean;
  pdfPrices: boolean;
  who: string;
  onOneMeal?: (date: string, m: MealSlot) => void;
  quotes: Quotation[];
  currentId: string | null;
}

// A one-meal quote has no offer price, ceremony name or per-meal dish-price switch, so such a meal stays a meal.
const oneMealFits = (m: MealSlot) => !(m.discount_amount > 0) && !m.ceremony_name && !m.hide_prices;

const nextDate = (iso: string) => {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

// Several meals or days: one tab per day, a card per meal with its time, guests, rate and dishes.
const QuotationMultiDay: React.FC<Props> = ({ eventDays, setEventDays, guestCount, defaultDate, menuItems, toLine, showPrices, pdfPrices, who, onOneMeal, quotes, currentId }) => {
  const [source, setSource] = useState<{ kind: 'package' | 'copy'; id: string } | null>(null);
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

  const mealCount = eventDays.reduce((n, d) => n + d.meals.length, 0);
  const meal = (m: MealSlot) => (
    <MealCard key={m.id} m={m} label={`Day ${getDayNumber(day.date, eventDays)} ${m.meal_type}`} menuItems={menuItems} toLine={toLine}
      showPrices={showPrices} pdfPrices={pdfPrices} who={who} onChange={fn => patchMeal(at, m.id, fn)}
      onRemove={() => patchDay(at, meals => meals.filter(x => x.id !== m.id))} onCopy={() => copyMeal(at, m)}
      moves={eventDays.map((d, i) => ({ i, label: `Move to Day ${getDayNumber(d.date, eventDays)}` })).filter(x => x.i !== at).map(x => ({ label: x.label, go: () => moveMeal(at, x.i, m) }))}
      onSource={kind => setSource({ kind, id: m.id })}
      onOneMeal={mealCount === 1 && onOneMeal && oneMealFits(m) ? () => onOneMeal(day.date, m) : undefined} />
  );

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
      {source && (() => {
        const m = day?.meals.find(x => x.id === source.id);
        if (!m) return null;
        const into = (add: QuotationLineItem[], replace: boolean, price?: number) =>
          patchMeal(at, m.id, x => { const items = mergeLines(x.items ?? [], add, replace); return price && price > 0 ? priceMeal(x, items, price) : withItems(x, items); });
        return source.kind === 'package'
          ? <PackageDialog menuItems={menuItems} hasDishes={(m.items ?? []).length > 0} guests={m.guest_count} onClose={() => setSource(null)}
              onApply={(found, menu, replace, missing) => {
                into(found.map(it => (it.choice ? { ...toLine(it), choice: it.choice } : toLine(it))), replace, priceAt(menu, m.guest_count));
                toast.success(`Added ${found.length} dish${found.length === 1 ? '' : 'es'} to ${m.meal_type}${missing.length ? ` · not in Menu Builder: ${missing.join(', ')}` : ''}`, { duration: 6000 });
              }} />
          : <CopyDialog quotes={quotes} currentId={currentId} hasDishes={(m.items ?? []).length > 0} onClose={() => setSource(null)} onCopy={(items, replace) => into(items, replace)} />;
      })()}
      {dialog}
    </>
  );
};

export default QuotationMultiDay;
