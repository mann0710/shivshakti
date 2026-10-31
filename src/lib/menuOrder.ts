import type { QuotationLineItem } from '../hooks/useQuotations';
import type { ChoiceGroup } from './quoteChoices';

// How a menu is laid out (design A): the owner's order and flat course lists. A dish sits in the
// course the owner gave it in this quote, else a "choose any" group's own course, else its Menu Builder
// category: dal, rice, breads, sabji and farsan kept under Main Course join one Main Course, and
// accompaniments go last unless the owner placed them.
export type Entry = { item: QuotationLineItem; choice?: undefined } | { choice: ChoiceGroup; item?: undefined };
export interface Course { name: string; entries: Entry[]; sum: number; count: number }

const MAIN = /main|sabji|sabzi|shaak|\bshak\b|vegetable|kathod|kathol|\bdal\b|daal|kadhi|rice|pulao|biryani|khichdi|bhaat|bread|roti|rotli|naan|puri|paratha|phulka|curry|gravy/i;
const ACCOMP = /includ|accompan|salad|chutney|chatni|achar|aachar|pickle|papad|raita|condiment|water|mukhwas|mouth\s*fresh/i;
const DIP = /chutney|chatni|sauce|\bdip\b|raita|achar|aachar|pickle/i;

const tags = (i: QuotationLineItem) => `${i.category_name || ''} ${i.subcategory_name || ''}`;
export const roleOf = (i: QuotationLineItem): 'accomp' | 'main' | 'own' =>
  ACCOMP.test(tags(i)) ? 'accomp' : MAIN.test(tags(i)) ? 'main' : 'own';

// Items offered in the "Served with" picker first.
export const isAccompaniment = (category = '', subcategory = '', name = '') =>
  ACCOMP.test(`${category} ${subcategory}`) || DIP.test(name);

// Names a dish is served with ("Coconut Chutney, Green Chutney").
export const servedNames = (i: Pick<QuotationLineItem, 'served_with'>) =>
  (i.served_with || '').split(',').map(s => s.trim()).filter(Boolean);

// A dish served with an item also on the menu prints it under the dish, not again in its course.
function dropServed(items: QuotationLineItem[]): QuotationLineItem[] {
  const ids = new Set(items.flatMap(i => i.served_ids ?? []));
  const names = new Set(items.flatMap(i => servedNames(i).map(n => n.toLowerCase())));
  return items.filter(i => i.choice || !(ids.has(i.item_id) || names.has(i.item_name.toLowerCase())));
}

const courseName = (i: QuotationLineItem, mainName: string, accompName: string) => {
  const own = i.course?.trim() || i.choice?.label?.trim();
  if (own) return own;
  if (roleOf(i) === 'accomp') return accompName;
  if (roleOf(i) === 'main') return mainName;
  return (i.category_name || '').trim() || (i.subcategory_name || '').trim() || 'Menu';
};

export function planCourses(all: QuotationLineItem[], opts: { merge?: boolean; groups?: ChoiceGroup[] } = {}): Course[] {
  const items = opts.merge ? dropServed(all ?? []) : all ?? [];
  const mainName = items.map(i => i.category_name).find(c => c && /main/i.test(c)) || 'Main Course';
  const accompName = items.map(i => i.category_name).find(c => c && ACCOMP.test(c)) || 'Accompaniments';
  const groupOf = new Map((opts.groups ?? []).map(g => [g.meta.id, g]));
  const courses: Course[] = [];
  const placed = new Set<Course>();

  for (const it of items) {
    const name = courseName(it, mainName, accompName);
    let c = courses.find(x => x.name === name);
    if (!c) { c = { name, entries: [], sum: 0, count: 0 }; courses.push(c); }
    if (it.course?.trim() || roleOf(it) !== 'accomp') placed.add(c);
    const g = it.choice && groupOf.get(it.choice.id);
    if (g) {
      if (!c.entries.some(e => e.choice?.meta.id === g.meta.id)) {
        c.entries.push({ choice: g });
        c.count += Math.min(Math.max(1, g.meta.pick), g.items.length);
      }
      continue;
    }
    c.entries.push({ item: it });
    c.sum += Number(it.amount) || 0;
    c.count += 1;
  }
  return [...courses.filter(c => placed.has(c)), ...courses.filter(c => !placed.has(c))];
}
