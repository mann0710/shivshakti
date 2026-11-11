import React from 'react';
import { Account } from '../../lib/credit/accounts';
import { AGES } from '../../lib/credit/items';
import { FILTERS, Filter, Sort } from '../../lib/credit/view';
import { plural } from '../../lib/credit/dates';
import { inr } from '../../lib/money';
import { Avatar, Tags, lineOf } from './CreditTags';

interface Props {
  rows: Account[];
  counts: Record<Filter, number>;
  ages: number[];
  filter: Filter;
  sort: Sort;
  q: string;
  selected?: string;
  today: string;
  empty: React.ReactNode;
  onFilter: (f: Filter) => void;
  onSort: (s: Sort) => void;
  onSearch: (q: string) => void;
  onSelect: (a: Account) => void;
  onRemind: (a: Account) => void;
  onReceive: (a: Account) => void;
}

const SORTS: [Sort, string][] = [['follow', 'Follow up first'], ['owed', 'Most owed'], ['oldest', 'Oldest'], ['name', 'Name']];
const hot = (ages: number[]) => { const max = Math.max(...ages); return max > 0 ? ages.indexOf(max) : -1; };

// Who owes: filters, age split by bill, and one row per customer with Remind and Receive.
const CreditList: React.FC<Props> = p => {
  const top = hot(p.ages);
  const shownOwed = p.rows.reduce((s, a) => s + a.owed, 0);
  return (
    <section className="cr-card cr-list" aria-label="Who owes">
      <div className="cr-bar">
        {FILTERS.filter(f => p.counts[f.id] > 0 || f.id === p.filter || f.id === 'today' || f.id === 'owing').map(f => (
          <button key={f.id} type="button" className="cr-chip" aria-pressed={p.filter === f.id} onClick={() => p.onFilter(f.id)}>
            {f.label}{f.id !== 'settled' ? ` · ${p.counts[f.id]}` : ''}
          </button>
        ))}
        <input type="search" placeholder="Name, mobile or bill #" aria-label="Search credit" value={p.q} onChange={e => p.onSearch(e.target.value)} />
        <select aria-label="Sort" value={p.sort} onChange={e => p.onSort(e.target.value as Sort)}>
          {SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      <div className="cr-ages" aria-label="What is due, by how old each bill is">
        {AGES.map((label, i) => (
          <div key={label} className={i === top ? 'hot' : undefined}><span>{label}</span><b className={i === top ? 'cr-red' : undefined}>{inr(p.ages[i])}</b></div>
        ))}
      </div>
      {!p.rows.length ? p.empty : p.rows.map(a => (
        <div key={a.phone} className="cr-row" role="button" tabIndex={0} aria-current={p.selected === a.phone} aria-label={`${a.name}, owes ${inr(a.owed)}`}
          onClick={() => p.onSelect(a)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); p.onSelect(a); } }}>
          <Avatar name={a.name} />
          <span className="cr-who"><span className="cr-tags"><b>{a.name}</b><Tags a={a} today={p.today} /></span><span>{lineOf(a, p.today)}</span></span>
          <span className="cr-amt">
            <b className={a.owed > 0 && !a.settings?.disputed ? 'cr-red' : a.owed > 0 ? '' : 'cr-green'}>{a.owed > 0 ? inr(a.owed) : a.advance > 0 ? inr(a.advance) : '₹0'}</b>
            <span>{a.owed > 0 ? (a.oldest ? plural(a.oldest, 'day') : 'today') : a.advance > 0 ? 'advance' : 'settled'}</span>
          </span>
          <span className="cr-acts" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
            {a.owed > 0 && !a.settings?.disputed && <button type="button" className="ui-btn" aria-label={`Remind ${a.name} on WhatsApp`} onClick={() => p.onRemind(a)}>Remind</button>}
            {a.owed > 0 && <button type="button" className="ui-btn cr-accent" onClick={() => p.onReceive(a)}>Receive</button>}
          </span>
        </div>
      ))}
      {p.rows.length > 0 && <div className="cr-foot">{plural(p.rows.length, 'customer')} shown{shownOwed > 0 ? ` · owe ${inr(shownOwed)}` : ''}</div>}
    </section>
  );
};

export default CreditList;
