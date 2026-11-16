import type { QuotationLineItem } from '../../hooks/useQuotations';
import { esc, money } from './theme';
import { choiceGroups, pickedOf, servedItems, plateRange, ChoiceGroup } from '../quoteChoices';
import { planCourses, servedExtra, subGroups, showSubs, Course, Entry } from '../menuOrder';

// The menu as balanced columns of course blocks (quotations, invoices, the event menu).

export const hasItemPrices = (items: QuotationLineItem[]) => (items ?? []).some(i => (Number(i.amount) || 0) > 0);

// true: dish prices make up the plate price. 'diff': your own higher plate price; dishes still print, choices show the difference.
export type PriceShow = boolean | 'diff';
export const priceShow = (on: boolean, plate: number, items: QuotationLineItem[] | undefined): PriceShow =>
  on && hasItemPrices(items ?? []) && plate > plateRange(items).min ? 'diff' : on;

// A course taller than this (in dish lines) may continue in the next column; shorter ones stay whole.
const SPLIT_ROWS = 4;
const LABEL_MAX = 116;

// One dish line: tick box (choices), name, price; then "with …" and the owner's note.
function dish(it: QuotationLineItem, price: string, tick?: boolean): string {
  const served = servedExtra(it);
  return `<div class="dish${tick === undefined ? '' : ' ticked'}"><div class="dl">${tick === undefined ? '' : `<span class="tick">${tick ? '✓' : ''}</span>`}<span class="n">${esc(it.item_name)}</span>${
    price ? `<span class="p num">${price}</span>` : ''}</div>${
    served.length ? `<div class="with">with ${esc(served.join(', '))}</div>` : ''}${
    it.instruction ? `<div class="note">${esc(it.instruction)}</div>` : ''}</div>`;
}
const itemPrice = (it: QuotationLineItem, prices: PriceShow) => (prices && Number(it.amount) > 0 ? money(it.amount) : '');
const dishLines = (it: QuotationLineItem) => 1 + (servedExtra(it).length ? 0.6 : 0) + (it.instruction ? 0.6 : 0);

// "Choose any N": name, then "Choose 1 of 3 · up to +₹40 / plate", then tick boxes (ticked once decided).
function choiceParts(g: ChoiceGroup, prices: PriceShow, label = g.meta.label) {
  const n = Math.min(Math.max(1, g.meta.pick), g.items.length);
  const decided = pickedOf(g).length > 0;
  const a = g.items.map(i => Number(i.amount) || 0).sort((x, y) => x - y);
  const lo = a.slice(0, n).reduce((s, x) => s + x, 0);
  const hi = a.slice(a.length - n).reduce((s, x) => s + x, 0);
  const diff = prices === 'diff';
  const priced = !decided && !!prices && !g.meta.included && (diff ? hi > lo : hi > 0);
  const price = (i: QuotationLineItem) => { const v = (Number(i.amount) || 0) - (diff ? a[0] : 0); return priced && v > 0 ? `+${money(v)}` : ''; };
  // With dish prices hidden, a pick that moves the price still says so.
  const varies = !decided && !g.meta.included && hi > lo;
  // One price whatever they pick: the plate carries the dearest pick, shown once.
  const fixed = !!prices && !!g.meta.included && hi > 0 ? `${money(hi)} / plate` : '';
  const cost = fixed || !priced ? fixed || (varies ? 'changes the plate price' : '') : diff || lo === 0 ? `up to +${money(diff ? hi - lo : hi)} / plate` : lo === hi ? `+${money(lo)} / plate` : `+${money(lo)} – ${money(hi)} / plate`;
  const rule = decided ? 'Your choice' : `Choose ${n} of ${g.items.length}`;
  const sub = `<div class="pick-sub">${rule}${cost ? ` · <span class="num">${cost}</span>` : ''}</div>`;
  const list = g.items.map(i => dish(i, price(i), !!i.chosen)).join('');
  return { head: `<div class="course-h">${esc(label)}</div>${sub}`, list, rows: 2.4 + g.items.reduce((s, i) => s + dishLines(i), 0) };
}

// Two "choose" boxes with the same title are numbered so the customer picks from each.
function choiceLabels(groups: ChoiceGroup[]): Map<string, string> {
  const total = new Map<string, number>();
  groups.forEach(g => total.set(g.meta.label, (total.get(g.meta.label) ?? 0) + 1));
  const seen = new Map<string, number>();
  return new Map(groups.map(g => {
    const k = (seen.get(g.meta.label) ?? 0) + 1;
    seen.set(g.meta.label, k);
    return [g.meta.id, (total.get(g.meta.label) ?? 0) > 1 ? `${g.meta.label} ${k}` : g.meta.label];
  }));
}

const single = (c: Course) => c.entries.length === 1 && !c.entries[0].choice && c.count === 1;

// Runs of one-dish courses become one compact list, the course name beside each dish.
type Block = { kind: 'course'; c: Course } | { kind: 'quick'; list: Course[] };
function blocksOf(courses: Course[]): Block[] {
  const out: Block[] = [];
  for (const c of courses) {
    const last = out[out.length - 1];
    if (single(c) && last?.kind === 'quick') last.list.push(c);
    else out.push(single(c) ? { kind: 'quick', list: [c] } : { kind: 'course', c });
  }
  return out;
}

// Layout design B: per meal (or menu), course blocks flow through two balanced columns. A course longer than
// SPLIT_ROWS may continue in the next column with its heading repeated; sections, dishes and choice boxes never split.
// Labels beside dishes (sections, one-dish courses) share one width per menu so they line up.
// "quote" shows choice groups to tick; "served" shows only what will be served. `hide` drops a course
// heading that only repeats the meal's name (Breakfast in the Breakfast card).
export function courseGrid(all: QuotationLineItem[], prices: PriceShow, mode: 'quote' | 'served' = 'quote', hide = ''): string {
  const items = mode === 'served' ? servedItems(all) : all;
  const decided = new Set(choiceGroups(items).filter(g => pickedOf(g).length).map(g => g.meta.id));
  const groups = choiceGroups(items).filter(g => mode === 'quote' || !decided.has(g.meta.id));
  // Served copies list decided picks as normal dishes; open choices stay as choices.
  const list = items.map(i => (i.choice && !groups.some(g => g.meta.id === i.choice!.id) ? { ...i, choice: undefined } : i));
  const labels = choiceLabels(groups);
  const parts = (g: ChoiceGroup) => choiceParts(g, prices, labels.get(g.meta.id));
  const blocks = blocksOf(planCourses(list, { merge: true, groups }));
  const sideLabels = blocks.flatMap(b => (b.kind === 'quick' ? b.list.map(c => c.name) : showSubs(subGroups(b.c)) ? subGroups(b.c).map(g => g.name) : []));
  const lw = Math.min(LABEL_MAX, Math.max(56, Math.round(Math.max(0, ...sideLabels.map(s => s.length)) * 6.2)));
  const row = (html: string) => `<tr><td>${html}</td></tr>`;
  const side = (label: string, body: string) => `<div class="sg"><div class="sg-l">${esc(label)}</div><div>${body}</div></div>`;

  const html = blocks.map(b => {
    if (b.kind === 'quick') {
      return `<div class="course quick">${b.list.map(c => side(c.name, dish(c.entries[0].item!, itemPrice(c.entries[0].item!, prices)))).join('')}</div>`;
    }
    const c = b.c;
    if (c.entries.length === 1 && c.entries[0].choice) {
      const p = parts(c.entries[0].choice);
      return `<div class="course pick">${p.head}${p.list}</div>`;
    }
    const entry = (e: Entry) => {
      if (!e.choice) return dish(e.item, itemPrice(e.item, prices));
      const p = parts(e.choice);
      return `<div class="pickbox">${p.head}${p.list}</div>`;
    };
    // A course mixing subcategories lists them beside small labels (Main Course › Farsan).
    const subs = subGroups(c);
    const heads = showSubs(subs);
    const body = subs.map(g => (heads && g.name ? row(side(g.name, g.entries.map(entry).join(''))) : g.entries.map(e => row(entry(e))).join(''))).join('');
    const rows = c.entries.reduce((s, e) => s + (e.choice ? parts(e.choice).rows : dishLines(e.item)), 0);
    const named = c.name.trim().toLowerCase() !== hide.trim().toLowerCase();
    const head = named ? `<thead><tr><th><div class="course-h">${esc(c.name)}<span class="num">${c.count} ${c.count === 1 ? 'dish' : 'dishes'}</span></div></th></tr></thead>` : '';
    return `<table class="course${rows > SPLIT_ROWS ? ' long' : ''}">${head}<tbody>${body}</tbody></table>`;
  }).join('');
  return `<div class="courses" style="--lw:${lw}px">${html}</div>`;
}
