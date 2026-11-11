import { roundMoney } from '../units';
import { Payment, PayKind, PayMode } from '../payments';
import { CreditItem } from './items';
import { Link } from './types';

// Splits an amount over what is due, oldest first (or one picked item first); the rest is left over.
export function allocate(open: CreditItem[], amount: number, firstId?: string): { links: Link[]; left: number } {
  const order = firstId ? [...open.filter(i => i.id === firstId), ...open.filter(i => i.id !== firstId)] : open;
  let left = roundMoney(Math.max(0, amount));
  const links: Link[] = [];
  for (const i of order) {
    if (left <= 0) break;
    const take = roundMoney(Math.min(left, i.due));
    if (take <= 0) continue;
    links.push({ type: i.type, id: i.id, amount: take });
    left = roundMoney(left - take);
  }
  return { links, left };
}

export interface Patch { item: CreditItem; payments: Payment[] }

// New payments lists for each linked item, every payment tagged with the entry that wrote it.
export function patchesFor(items: CreditItem[], links: Link[], p: { mode: PayMode; at: string; kind: PayKind; ref: string; note?: string }): Patch[] {
  return links.flatMap(l => {
    const item = items.find(i => i.id === l.id && i.type === l.type);
    if (!item) return [];
    const add: Payment = { amount: l.amount, mode: p.mode, at: p.at, kind: p.kind, ref: p.ref, ...(p.note ? { note: p.note } : {}) };
    return [{ item, payments: [...item.payments, add] }];
  });
}

// Undo: each linked item without the payments that entry wrote.
export const undoPatches = (items: CreditItem[], links: Link[], ref: string): Patch[] =>
  links.flatMap(l => {
    const item = items.find(i => i.id === l.id && i.type === l.type);
    return item ? [{ item, payments: item.payments.filter(x => x.ref !== ref) }] : [];
  });
