import type { QuotationLineItem } from '../hooks/useQuotations';
import { coursesOf } from './quoteSummary';

// Owner's changes to a quote's courses: move a dish anywhere, move a whole course, rename one.
type Items = QuotationLineItem[];

// Course name → its dishes' ids (a "choose any" group's dishes included), in course order.
export function courseMap(items: Items): Map<string, string[]> {
  return new Map(coursesOf(items).map(c => [c.name, c.entries.flatMap(e => (e.choice ? e.choice.items : [e.item!])).map(i => i.item_id)]));
}

const courseOfId = (map: Map<string, string[]>, id: string) => Array.from(map).find(([, ids]) => ids.includes(id))?.[0];

// The dishes in the order they show, each once, with the course it shows in.
function shown(items: Items, map: Map<string, string[]>, order = Array.from(map.keys())): { item: QuotationLineItem; course: string }[] {
  const byId = new Map(items.map(i => [i.item_id, i]));
  const seen = new Set<string>();
  return order.flatMap(n => (map.get(n) ?? []).filter(id => !seen.has(id) && seen.add(id) && byId.has(id)).map(id => ({ item: byId.get(id)!, course: n })));
}

// A dish with a "choose any" group brings the whole group along.
const moversOf = (items: Items, id: string) => {
  const g = items.find(i => i.item_id === id)?.choice?.id;
  return new Set(g ? items.filter(i => i.choice?.id === g).map(i => i.item_id) : [id]);
};

// Puts a dish (and its group) in a course, new or existing, at the end of that course.
export function setCourse(items: Items, id: string, course: string): Items {
  return dropDish(items, id, { course });
}

// Drag and drop: before another dish, or at the end of a course; the dish takes that course.
export function dropDish(items: Items, id: string, to: { course: string; beforeId?: string }): Items {
  const name = to.course.trim();
  const map = courseMap(items);
  if (!name || to.beforeId === id) return items;
  const changes = courseOfId(map, id) !== name;
  const movers = changes ? moversOf(items, id) : new Set([id]);
  // Work on the on-screen order so moving a course's first dish never reorders the courses.
  const base = shown(items, map).map(s => s.item);
  const rest = base.filter(i => !movers.has(i.item_id));
  const moved = base.filter(i => movers.has(i.item_id));
  if (!moved.length || (to.beforeId && movers.has(to.beforeId))) return items;
  const target = map.get(name)?.filter(x => !movers.has(x)) ?? [];
  const before = to.beforeId ?? null;
  let at = before ? rest.findIndex(i => i.item_id === before) : -1;
  if (at < 0) {
    const last = target.length ? Math.max(...target.map(t => rest.findIndex(i => i.item_id === t))) : -1;
    at = last >= 0 ? last + 1 : rest.length;
  }
  const next = [...rest.slice(0, at), ...moved, ...rest.slice(at)];
  return changes ? next.map(i => (movers.has(i.item_id) ? { ...i, course: name } : i)) : next;
}

// Moves a whole course before or after another; every course is pinned so the order holds.
export function moveCourse(items: Items, from: string, to: string, after: boolean): Items {
  const map = courseMap(items);
  const names = Array.from(map.keys());
  if (from === to || !map.has(from) || !map.has(to)) return items;
  const order = names.filter(n => n !== from);
  order.splice(order.indexOf(to) + (after ? 1 : 0), 0, from);
  return shown(items, map, order).map(({ item, course }) => ({ ...item, course }));
}

// Renames a course in this quote, keeping every course where it shows; a blank name puts its
// dishes back on Menu Builder's courses.
export function renameCourse(items: Items, from: string, to: string): Items {
  const name = to.trim();
  const map = courseMap(items);
  if (name === from || !map.has(from)) return items;
  return shown(items, map).map(({ item: i, course }) => {
    if (course !== from) return i;
    const choice = i.choice && name && i.choice.label === from ? { ...i.choice, label: name } : i.choice;
    return { ...i, choice, course: name || undefined };
  });
}
