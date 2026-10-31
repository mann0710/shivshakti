import type { ChoiceMeta, QuotationLineItem } from '../../hooks/useQuotations';
import type { PickerItem } from '../../lib/quoteLines';
import { choiceGroups, newChoiceId, pickedOf } from '../../lib/quoteChoices';
import { coursesOf } from '../../lib/quoteSummary';

// A quote's menu as package lines and back; a kept choice is one course line, "Farsan 1(South Boll / Mix Bhajiya)".
export type PackageDish = PickerItem & { choice?: ChoiceMeta };

const SEP = ' / ';
const key = (s: string) => s.trim().toLowerCase();
const once = <T,>(list: T[], id: (x: T) => string) => list.filter((x, i) => list.findIndex(y => id(y) === id(x)) === i);

// "Sweet · Main Course (5) · Farsan — choose 1 of 2"
export const courseSummary = (items: QuotationLineItem[]) => coursesOf(items).map(c => {
  const dishes = c.entries.filter(e => e.item).length;
  const picks = c.entries.flatMap(e => (e.choice ? [`choose ${Math.min(Math.max(1, e.choice.meta.pick), e.choice.items.length)} of ${e.choice.items.length}`] : []));
  return [dishes > 1 ? `${c.name} (${dishes})` : c.name, ...picks].join(' — ');
}).join(' · ');

// "choose 1 farsan" for the keep-as-a-choice box.
export const choiceNames = (items: QuotationLineItem[]) => choiceGroups(items).map(g => `"choose ${g.meta.pick} ${g.meta.label.toLowerCase()}"`);

// Package lines from a quote: kept choices as course lines, else the picked dishes (or all when none picked).
export function packageLines(items: QuotationLineItem[], keepChoices: boolean): string[] {
  const groups = new Map(choiceGroups(items).map(g => [g.meta.id, g]));
  const out = items.flatMap(it => {
    const g = it.choice && groups.get(it.choice.id);
    if (!g) return [it.item_name];
    if (g.items[0] !== it) return [];
    if (keepChoices) return [`${g.meta.label || it.category_name || 'Choice'} ${Math.max(1, g.meta.pick)}(${g.items.map(i => i.item_name).join(SEP)})`];
    return (pickedOf(g).length ? pickedOf(g) : g.items).map(i => i.item_name);
  });
  return once(out, key);
}

// Package lines to Menu Builder dishes; a course line naming dishes becomes a choose-N group again.
export function packageDishes(lines: string[], menu: PickerItem[]): { found: PackageDish[]; missing: string[] } {
  const byName = new Map(menu.map(it => [key(it.name), it]));
  const found: PackageDish[] = [];
  const missing: string[] = [];
  lines.forEach(line => {
    const dish = byName.get(key(line));
    const m = dish ? null : line.match(/^(.*?)\s*(\d{1,2})\s*\((.+)\)$/);
    if (dish || !m) { if (dish) found.push(dish); else missing.push(line); return; }
    const names = m[3].split('/').map(n => n.trim()).filter(Boolean);
    const hits = names.map(n => byName.get(key(n))).filter((x): x is PickerItem => !!x);
    missing.push(...names.filter(n => !byName.has(key(n))));
    if (hits.length < 2) { found.push(...hits); return; }
    const choice: ChoiceMeta = { id: newChoiceId(), label: m[1].trim() || 'Choice', pick: Math.min(Math.max(1, Number(m[2])), hits.length) };
    found.push(...hits.map(h => ({ ...h, choice })));
  });
  return { found: once(found, d => d.id), missing };
}
