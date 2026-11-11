import React from 'react';
import { Account } from '../../lib/credit/accounts';
import { ledgerOf } from '../../lib/credit/ledger';
import { lateBy } from '../../lib/credit/items';
import { shortDay, plural } from '../../lib/credit/dates';
import { CreditEntry, OUTCOMES } from '../../lib/credit/types';
import { formatPhone } from '../../lib/people';
import { inr } from '../../lib/money';
import DotsMenu, { DotsItem } from '../people/DotsMenu';
import { Avatar, Tags } from './CreditTags';

export type PanelAction = 'receive' | 'remind' | 'statement' | 'promise' | 'call' | 'settings' | 'writeoff' | 'advance' | 'customer' | 'bill';

interface Props {
  a: Account;
  today: string;
  owner: boolean;
  ready: boolean; // credit tables exist
  onAction: (k: PanelAction) => void;
  onUndo: (e: CreditEntry) => void;
  onBack: () => void;
}

const FOLLOW_KINDS = ['promise', 'reminder', 'call', 'note', 'override', 'writeoff'];
const outcome = (e: CreditEntry) => OUTCOMES.find(o => o.id === e.outcome)?.label;

// One line of the follow-up history.
function followText(e: CreditEntry, today: string): string {
  const by = e.by_email ? ` · ${e.by_email.split('@')[0]}` : '';
  const note = e.note ? ` · “${e.note}”` : '';
  switch (e.kind) {
    case 'promise': return `Promised ${e.amount ? inr(e.amount) + ' ' : ''}by ${shortDay(e.promise_date ?? today, today)}${note}${by}`;
    case 'reminder': return `WhatsApp reminder for ${inr(e.amount)} (${e.note ?? 'English'})${by}`;
    case 'call': return `Called · ${outcome(e) ?? ''}${note}${by}`;
    case 'override': return `Owner allowed credit of ${inr(e.amount)}${note}${by}`;
    case 'writeoff': return `${e.note ?? 'Let go'} · ${inr(e.amount)}${by}`;
    default: return `${e.note ?? 'Note'}${by}`;
  }
}

// One customer's credit: what they owe, the limit, actions, what is due, the statement and follow-ups.
const CreditPanel: React.FC<Props> = ({ a, today, owner, ready, onAction, onUndo, onBack }) => {
  const rows = ledgerOf(a).reverse();
  const receipts = new Map(a.entries.filter(e => e.kind === 'receipt' && !e.voided_at).map(e => [e.id, e]));
  const follows = a.entries.filter(e => FOLLOW_KINDS.includes(e.kind) && !e.voided_at).slice(0, 8);
  const used = a.limit ? Math.min(100, Math.round((a.owed / a.limit) * 100)) : 0;
  const bad = a.owed > 0 && (a.over > 0 || a.late > 0 || !!a.promise?.broken);
  const own = a.settings?.credit_limit != null;

  const menu: DotsItem[] = [
    ...(ready && owner ? [{ label: 'Credit settings…', onClick: () => onAction('settings') }] : []),
    ...(a.owed > 0 && owner ? [{ label: 'Let go or write off…', onClick: () => onAction('writeoff') }] : []),
    ...(a.advance > 0 && a.owed > 0 ? [{ label: `Pay ${inr(Math.min(a.advance, a.owed))} from advance`, onClick: () => onAction('advance') }] : []),
    { label: 'New sweets bill', onClick: () => onAction('bill'), sep: true },
    { label: 'Open in Customers', onClick: () => onAction('customer') },
  ];

  return (
    <aside className="cr-card cr-panel" aria-label={`${a.name}'s credit account`}>
      <button type="button" className="ui-btn cr-back" onClick={onBack}>‹ All customers</button>
      <div className="cr-top">
        <Avatar name={a.name} big />
        <span className="cr-who" style={{ flex: 1 }}>
          <b>{a.name}</b>
          <span>{formatPhone(a.phone)} · on credit since {shortDay(a.since, today)}{a.settings?.lang === 'hi' ? ' · reminders in Hindi' : ''}</span>
          <Tags a={a} today={today} />
        </span>
        <DotsMenu label={`More for ${a.name}`} items={menu} />
      </div>

      <div className={`cr-owes${bad ? '' : ' ok'}`}>
        <span className="line"><span>{a.owed > 0 ? 'Owes you' : a.advance > 0 ? 'Advance with you' : 'Nothing due'}</span><b>{inr(a.owed > 0 ? a.owed : a.advance)}</b></span>
        {a.limit != null && a.owed > 0 && <span className={`cr-meter${a.over > 0 ? '' : ' ok'}`} aria-hidden="true"><span style={{ width: `${used}%` }} /></span>}
        <span style={{ fontSize: 12.5, fontWeight: 400 }}>
          {a.settings?.no_credit ? 'No more credit for this customer · ' : ''}
          {a.limit != null ? `Limit ${inr(a.limit)} (${own ? 'own' : 'shop default'})${a.over > 0 ? ` · ${inr(a.over)} over` : ''}` : 'No limit'}
          {a.owed > 0 ? ` · oldest ${plural(a.oldest, 'day')}` : ''}{a.advance > 0 && a.owed > 0 ? ` · ${inr(a.advance)} advance` : ''}
        </span>
      </div>

      <div className="cr-btns">
        {a.owed > 0 && <button type="button" className="ui-btn primary wide" onClick={() => onAction('receive')}>Receive payment</button>}
        {a.owed > 0 && !a.settings?.disputed && <button type="button" className="ui-btn" onClick={() => onAction('remind')}>Remind on WhatsApp</button>}
        <button type="button" className="ui-btn" onClick={() => onAction('statement')}>Statement PDF</button>
        {ready && a.owed > 0 && <button type="button" className="ui-btn" onClick={() => onAction('promise')}>Promised to pay…</button>}
        {ready && <button type="button" className="ui-btn" onClick={() => onAction('call')}>Log a call</button>}
      </div>

      {a.open.length > 0 && (
        <div className="cr-sec">
          <small>Still due · oldest first</small>
          {a.open.map(i => {
            const late = lateBy(i, today);
            return (
              <div key={i.type + i.id} className="cr-open">
                <span className={late ? 'late' : undefined}><b>{i.label} · {shortDay(i.day, today)}</b>
                  {i.what} · {i.due < i.given ? `${inr(i.given - i.due)} paid · ` : ''}{late ? `${plural(late, 'day')} late` : `pay by ${shortDay(i.payBy, today)}`}</span>
                <b className="cr-red">{inr(i.due)}</b>
              </div>
            );
          })}
        </div>
      )}

      <div className="cr-sec">
        <small>Account</small>
        {!rows.length ? <span className="cr-foot" style={{ padding: 0 }}>Nothing on credit yet.</span> : (
          <table className="cr-ledger">
            <thead><tr><th>Date</th><th>Details</th><th className="r">Given</th><th className="r">Got</th><th className="r hide-sm">Balance</th></tr></thead>
            <tbody>
              {rows.map((r, n) => (
                <tr key={n}>
                  <td className="r" style={{ textAlign: 'left' }}>{shortDay(r.day, today)}</td>
                  <td>{r.what}
                    {r.ref && receipts.has(r.ref) && <button type="button" className="ui-btn undo" aria-label={`Undo this payment of ${inr(r.got)}`} onClick={() => onUndo(receipts.get(r.ref!)!)}>Undo</button>}
                    <div className="sub">{r.sub}</div></td>
                  <td className="r cr-red">{r.given ? inr(r.given) : ''}</td>
                  <td className="r cr-green">{r.got ? inr(r.got) : ''}</td>
                  <td className="r hide-sm"><b>{inr(r.balance)}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="cr-sec" style={{ paddingBottom: 16 }}>
        <small>Follow-ups</small>
        {a.nextFollow && <div className="cr-follow"><span>{a.nextFollow <= today ? 'Today' : shortDay(a.nextFollow, today)}</span><span><b>{a.promise?.broken ? 'Missed promise: chase it' : a.promise ? 'Check the promised payment' : 'Remind again'}</b></span></div>}
        {follows.map(e => <div key={e.id} className="cr-follow"><span>{shortDay(e.at, today)}</span><span>{followText(e, today)}</span></div>)}
        {!follows.length && !a.nextFollow && <span className="cr-foot" style={{ padding: 0 }}>No follow-ups yet.</span>}
        {a.settings?.note && <div className="cr-follow"><span>Note</span><span>{a.settings.note}</span></div>}
      </div>
    </aside>
  );
};

export default CreditPanel;
