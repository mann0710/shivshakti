import { inr } from '../money';
import { roundMoney } from '../units';
import { Account } from './accounts';
import { shortDay, plural } from './dates';
import { CreditSettings } from './types';

// Whether a new bill may go on credit for this customer, and why not.

export type Level = 'ok' | 'warn' | 'block';
export interface Check { level: Level; reasons: string[]; owed: number; after: number; limit: number | null; advance: number }

export function checkCredit(a: Account | undefined, amount: number, s: CreditSettings, today: string): Check {
  const owed = a?.owed ?? 0;
  const advance = a?.advance ?? 0;
  const after = roundMoney(owed + amount - Math.min(advance, amount));
  const limit = a ? a.limit : s.limit > 0 ? s.limit : null;
  const blocks: string[] = [];
  const warns: string[] = [];
  const hard = (text: string) => (s.over === 'block' ? blocks : warns).push(text);

  if (!s.on) blocks.push('Credit is turned off in Settings › Credit.');
  if (a?.settings?.no_credit) blocks.push(`No credit for ${a.name} (set in their credit settings).`);
  if (a?.settings?.disputed) warns.push(`${a.name} says some of this is not owed. Sort it out before giving more.`);
  if (limit != null && after > limit) hard(`${inr(roundMoney(after - limit))} over the ${inr(limit)} limit after this bill.`);
  if (s.block_days > 0 && a && a.open.length && a.oldest > s.block_days) hard(`A bill from ${plural(a.oldest, 'day')} ago is still unpaid.`);
  if (a?.promise?.broken) warns.push(`Missed the promise to pay by ${shortDay(a.promise.date, today)}.`);
  else if (a?.promise) warns.push(`Promised to pay ${inr(a.promise.amount || owed)} by ${shortDay(a.promise.date, today)}.`);
  if (a && a.late > 0 && !a.promise) warns.push(`A pay-by date passed ${plural(a.late, 'day')} ago.`);

  return { level: blocks.length ? 'block' : warns.length ? 'warn' : 'ok', reasons: [...blocks, ...warns], owed, after, limit, advance };
}
