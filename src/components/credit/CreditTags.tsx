import React from 'react';
import { Account } from '../../lib/credit/accounts';
import { shortDay, plural } from '../../lib/credit/dates';
import { inr } from '../../lib/money';
import { initials } from '../../lib/people';

type Tone = 'red' | 'amber' | 'blue' | 'grey' | 'green';

// Status chips for one account, most urgent first.
export function tagsOf(a: Account, today: string): [string, Tone][] {
  const out: [string, Tone][] = [];
  if (a.over > 0) out.push(['Over limit', 'red']);
  if (a.promise?.broken) out.push([`Missed promise ${shortDay(a.promise.date, today)}`, 'red']);
  else if (a.promise) out.push([`Promised ${shortDay(a.promise.date, today)}`, 'blue']);
  else if (a.late > 0) out.push([`${plural(a.late, 'day')} late`, 'red']);
  if (a.follow === 'today' && !a.promise?.broken && !a.settings?.disputed) out.push(['Follow up today', 'amber']);
  if (a.settings?.disputed) out.push(['Disputed', 'grey']);
  if (a.settings?.no_credit) out.push(['No credit', 'grey']);
  if (a.advance > 0) out.push([`Advance ${inr(a.advance)}`, 'green']);
  return out;
}

export const Tags: React.FC<{ a: Account; today: string }> = ({ a, today }) => (
  <span className="cr-tags">{tagsOf(a, today).map(([t, tone]) => <span key={t} className={`cr-tag ${tone}`}>{t}</span>)}</span>
);

export const Avatar: React.FC<{ name: string; big?: boolean }> = ({ name, big }) => <span className={`cr-av${big ? ' big' : ''}`} aria-hidden="true">{initials(name)}</span>;

// One line under the name: what is due and the last contact.
export function lineOf(a: Account, today: string): string {
  if (!a.open.length) return a.advance > 0 ? 'Paid more than owed · kept as advance' : 'Nothing due';
  const first = a.open[0];
  const what = a.open.length === 1 ? `${first.label} · ${first.what}` : `${plural(a.open.length, 'bill')} · oldest ${shortDay(first.day, today)}`;
  const c = a.lastContact;
  const contact = c ? `${c.kind === 'call' ? 'called' : 'reminded'} ${shortDay(c.at, today)}` : '';
  return [what, contact].filter(Boolean).join(' · ');
}
