import type { Quotation, QuotationLineItem } from '../hooks/useQuotations';
import { choiceGroups, pickedOf } from './quoteChoices';
import { planCourses, servedExtra } from './menuOrder';
import { daysOf, mealTitle } from './docs/menu';

// The booked menu as the event page shows it: courses with the customer's picks, open choices flagged.
export interface PickLine { label: string; chosen: string[]; options: string[] }
export interface CourseLine { name: string; dishes: string[]; open: boolean }
export interface MenuBlock { title: string; picks: PickLine[]; courses: CourseLine[] }

const dishName = (i: QuotationLineItem) => {
  const extra = servedExtra(i);
  return extra.length ? `${i.item_name} with ${extra.join(', ')}` : i.item_name;
};

export const picksOf = (items: QuotationLineItem[]): PickLine[] =>
  choiceGroups(items).map(g => ({ label: g.meta.label, chosen: pickedOf(g).map(dishName), options: g.items.map(dishName) }));

export function courseLines(items: QuotationLineItem[]): CourseLine[] {
  const groups = choiceGroups(items);
  return planCourses(items, { merge: true, groups }).map(c => {
    let open = false;
    const dishes = c.entries.map(e => {
      if (!e.choice) return dishName(e.item);
      const got = pickedOf(e.choice);
      if (got.length) return got.map(dishName).join(', ');
      open = true;
      return `${e.choice.items.map(dishName).join(' or ')} (to pick)`;
    });
    return { name: c.name, dishes, open };
  });
}

const block = (title: string, items: QuotationLineItem[] = []): MenuBlock => ({ title, picks: picksOf(items), courses: courseLines(items) });

export function eventMenu(q?: Quotation): MenuBlock[] {
  if (!q) return [];
  if (q.is_multi_day && q.event_days?.length) {
    return daysOf(q.event_days).flatMap(g => g.meals.map(m => block(`Day ${g.number} · ${mealTitle(m)}`, m.items)));
  }
  return [block('', q.items)];
}
