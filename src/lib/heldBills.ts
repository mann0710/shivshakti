import { PosForm, WALK_IN, totalsOf } from './posForm';
import { inr } from './money';

// Bills kept aside at the counter (stored on this device only).
export interface HeldBill { id: string; at: string; form: PosForm }

export const MAX_HELD = 20;

export const holdBill = (list: HeldBill[], form: PosForm, at = new Date().toISOString()): HeldBill[] =>
  [{ id: `${at}-${Math.random().toString(36).slice(2, 7)}`, at, form }, ...list].slice(0, MAX_HELD);

// Takes one bill out; whatever was on the counter is held in its place.
export function takeHeld(list: HeldBill[], id: string, current?: PosForm, at?: string): { form: PosForm | null; list: HeldBill[] } {
  const found = list.find(h => h.id === id);
  if (!found) return { form: null, list };
  const rest = list.filter(h => h.id !== id);
  return { form: found.form, list: current?.lines.length ? holdBill(rest, current, at) : rest };
}

export const dropHeld = (list: HeldBill[], id: string) => list.filter(h => h.id !== id);

export function heldSummary(h: HeldBill): { name: string; detail: string } {
  const count = h.form.lines.reduce((s, l) => s + l.qty, 0);
  const time = new Date(h.at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
  return {
    name: h.form.customer_name.trim() || WALK_IN,
    detail: `${count} item${count === 1 ? '' : 's'} · ${inr(totalsOf(h.form).total)} · held ${time}${h.form.mode === 'preorder' ? ' · pre-booking' : ''}`,
  };
}
