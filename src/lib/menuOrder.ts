import type { QuotationLineItem } from '../hooks/useQuotations';
import type { ChoiceGroup } from './quoteChoices';

// How a menu is laid out on paper: the owner's order, one Main Course, accompaniments last,
// chutneys with the snack they go with, and "choose any" groups inside their own course.
export interface Sub { name: string; items: QuotationLineItem[]; note?: string; choice?: ChoiceGroup }
export interface Course { name: string; subs: Sub[]; sum: number; count: number }

const MAIN = /main|sabji|sabzi|shaak|\bshak\b|vegetable|kathod|kathol|\bdal\b|daal|kadhi|rice|pulao|biryani|khichdi|bhaat|bread|roti|rotli|naan|puri|paratha|phulka|curry|gravy/i;
const ACCOMP = /includ|accompan|salad|chutney|chatni|achar|aachar|pickle|papad|raita|condiment|water|mukhwas|mouth\s*fresh/i;
const SNACK = /farsan|starter|snack|chaat|appeti/i;
const DIP = /chutney|chatni|sauce|\bdip\b/i;

const tags = (i: QuotationLineItem) => `${i.category_name || ''} ${i.subcategory_name || ''}`;
export const roleOf = (i: QuotationLineItem): 'accomp' | 'main' | 'own' =>
  ACCOMP.test(tags(i)) ? 'accomp' : MAIN.test(tags(i)) ? 'main' : 'own';

// Chutneys move next to the snack they go with; "Served with" typed by the owner always wins.
function pairDips(items: QuotationLineItem[]): QuotationLineItem[] {
  const said = (name: string) => items.some(i => (i.served_with || '').toLowerCase().includes(name.toLowerCase()));
  const snack = items.find(i => !i.choice && SNACK.test(tags(i)));
  const dips = items.filter(i => !i.choice && roleOf(i) === 'accomp' && DIP.test(i.item_name));
  const gone = new Set<string>();
  const extra: string[] = [];
  dips.forEach(d => {
    if (said(d.item_name)) gone.add(d.item_id);
    else if (snack) { gone.add(d.item_id); extra.push(d.item_name); }
  });
  return items.filter(i => !gone.has(i.item_id)).map(i => (snack && i.item_id === snack.item_id && extra.length
    ? { ...i, served_with: [i.served_with, ...extra].filter(Boolean).join(', ') } : i));
}

export function planCourses(all: QuotationLineItem[], opts: { pair?: boolean; groups?: ChoiceGroup[] } = {}): Course[] {
  const items = opts.pair ? pairDips(all ?? []) : all ?? [];
  const mainName = items.map(i => i.category_name).find(c => c && /main/i.test(c)) || 'Main Course';
  const accompName = items.map(i => i.category_name).find(c => c && ACCOMP.test(c)) || 'Accompaniments';
  const groupOf = new Map((opts.groups ?? []).map(g => [g.meta.id, g]));
  const courses: Course[] = [];
  let accomp: Course | null = null;

  for (const it of items) {
    const role = roleOf(it);
    const name = role === 'main' ? mainName : role === 'accomp' ? accompName : (it.category_name || it.subcategory_name || 'Menu').trim();
    let c: Course | null | undefined = role === 'accomp' ? accomp : courses.find(x => x.name === name);
    if (!c) {
      c = { name, subs: [], sum: 0, count: 0 };
      if (role === 'accomp') accomp = c; else courses.push(c);
    }
    // Inside Main Course, a separate category (Delicious Dal, Aromatic Rice) becomes the sub-heading.
    const subName = (role === 'main' && it.category_name && it.category_name !== mainName ? it.category_name : it.subcategory_name || '').trim();
    const g = it.choice && groupOf.get(it.choice.id);
    if (g) {
      if (!c.subs.some(s => s.choice?.meta.id === g.meta.id)) c.subs.push({ name: subName, items: [], choice: g });
      continue;
    }
    let s = c.subs.find(x => !x.choice && x.name === subName);
    if (!s) { s = { name: subName, items: [] }; c.subs.push(s); }
    s.items.push(it);
    c.sum += Number(it.amount) || 0;
    c.count += 1;
  }
  return accomp ? [...courses, accomp] : courses;
}
