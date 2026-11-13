import type { Payment } from '../types';
import { PayStep, scheduleAmounts } from './docs/settings';
import { inr } from './money';
import { roundMoney } from './units';

// Money on one catering booking: every payment (before or after the invoice) against the invoice or quote total.

export interface QuickPick { label: string; value: number }
export interface Basis { total: number; label: 'Invoice' | 'Quote' | ''; range: boolean }
export interface Money extends Basis { received: number; due: number; over: number; count: number }

export const paymentsFor = (list: Payment[], bookingId: string) =>
  list.filter(p => p.booking_id === bookingId)
    .sort((a, b) => a.payment_date.localeCompare(b.payment_date) || (a.created_at ?? '').localeCompare(b.created_at ?? ''));

export const receivedOf = (list: Pick<Payment, 'amount'>[]) => roundMoney(list.reduce((s, p) => s + (Number(p.amount) || 0), 0));

// The invoice, else the quote (its lower price while options are open), else nothing yet.
export function basisOf(invoice?: { total_amount: number }, quote?: { total_amount: number; total_max?: number | null; status?: string }): Basis {
  if (invoice) return { total: Number(invoice.total_amount) || 0, label: 'Invoice', range: false };
  if (!quote || quote.status === 'rejected') return { total: 0, label: '', range: false };
  const lo = Number(quote.total_amount) || 0;
  return { total: lo, label: 'Quote', range: Math.max(lo, Number(quote.total_max) || 0) > lo };
}

export function moneyOf(basis: Basis, payments: Pick<Payment, 'amount'>[]): Money {
  const received = receivedOf(payments);
  return {
    ...basis, received, count: payments.length,
    due: roundMoney(Math.max(0, basis.total - received)),
    over: basis.total > 0 ? roundMoney(Math.max(0, received - basis.total)) : 0,
  };
}

const uniq = (list: QuickPick[]) => list.filter((x, i) => x.value > 0 && list.findIndex(y => y.value === x.value) === i);

// Confirming: the plan's first step, 25% and the full amount.
export function confirmPicks(total: number, plan: PayStep[]): QuickPick[] {
  if (!(total > 0)) return [];
  const first = plan[0];
  return uniq([
    ...(first ? [{ label: `${first.label || 'To confirm'} ${first.pct}% · ${inr(scheduleAmounts(total, plan)[0])}`, value: scheduleAmounts(total, plan)[0] }] : []),
    { label: `25% · ${inr(Math.round(total / 4))}`, value: Math.round(total / 4) },
    { label: `Full · ${inr(total)}`, value: total },
  ]);
}

// A later payment: the next plan step not yet covered, the balance and half of it.
export function paymentPicks(total: number, plan: PayStep[], received: number): QuickPick[] {
  const due = roundMoney(total - received);
  if (!(total > 0) || due <= 0) return [];
  const amounts = scheduleAmounts(total, plan);
  let upTo = 0;
  const at = amounts.findIndex(a => (upTo += a) - received >= 1);
  const next = at >= 0 && at < plan.length - 1 ? { step: plan[at], value: roundMoney(upTo - received) } : null;
  return uniq([
    ...(next ? [{ label: `Next in plan: ${next.step.label || 'Advance'} ${next.step.pct}% · ${inr(next.value)}`, value: next.value }] : []),
    { label: `Balance · ${inr(due)}`, value: due },
    ...(due >= 2 ? [{ label: `Half · ${inr(Math.ceil(due / 2))}`, value: Math.ceil(due / 2) }] : []),
  ]);
}

export type ChipTone = 'good' | 'warn';
// One line under the amount on the bookings list.
export function moneyChip(stage: string, m: Money): { text: string; tone: ChipTone } | null {
  if (stage === 'cancelled' || stage === 'inquiry') return null;
  if (m.received <= 0) return stage === 'confirmed' ? { text: 'No advance yet', tone: 'warn' } : null;
  if (m.over > 0) return { text: `${inr(m.received)} received · ${inr(m.over)} extra`, tone: 'warn' };
  if (m.total > 0 && m.due <= 0) return { text: 'Paid in full', tone: 'good' };
  return { text: `${inr(m.received)} received${m.total > 0 ? ` · ${inr(m.due)} due` : ''}`, tone: 'good' };
}

// Money before the event day is an advance; on or after it, a part payment.
export const payTypeOn = (eventDate: string, day: string): Payment['payment_type'] => (eventDate > day ? 'advance' : 'partial');
