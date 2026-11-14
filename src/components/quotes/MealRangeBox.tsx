import React from 'react';
import type { QuoteForm } from '../../hooks/useQuoteForm';
import { oneEveryMeal, rangedMeals, setMealOnePrice } from '../../lib/mealPrice';
import { cap } from '../../lib/docs/theme';
import { inr } from '../../lib/money';
import { range } from '../../lib/quoteSummary';
import { undoToast } from '../pos/undoToast';

// Multi-day quote: names the meals still priced by the pick, and puts them all on one price in a tap.
const MealRangeBox: React.FC<{ f: QuoteForm }> = ({ f }) => {
  const list = rangedMeals(f.eventDays);
  if (!f.isMultiDay || !list.length) return null;
  const names = list.map(x => `Day ${x.day} ${cap(x.meal.meal_type)}`);
  const both = list.length === 1 ? 'this meal' : list.length === 2 ? 'both meals' : `all ${list.length} meals`;
  const apply = () => {
    const before = f.eventDays;
    f.setEventDays(oneEveryMeal(before));
    undoToast(`One price on ${list.length} meal${list.length === 1 ? '' : 's'} · ${inr(f.totalMax ?? f.totals.final)}`, () => f.setEventDays(before));
  };
  return (
    <div className="q-warnbox q-ranges" aria-live="polite">
      <span><b>Your customer will see a total of {range(f.totals.final, f.totalMax)}</b> because {list.length === 1 ? '1 meal depends' : `${list.length} meals depend`} on what they choose: {names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0]}.</span>
      <span>Same price whatever they choose: {list.map(x => `${cap(x.meal.meal_type)} ${inr(setMealOnePrice(x.meal, true).per_plate_amount)}`).join(' · ')} a plate → total {inr(f.totalMax ?? f.totals.final)}</span>
      <button type="button" className="ui-btn primary" onClick={apply}>Use one price on {both}</button>
    </div>
  );
};

export default MealRangeBox;
