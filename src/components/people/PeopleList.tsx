import React from 'react';
import { inr } from '../../lib/money';
import { initials, savedTwiceReason } from '../../lib/people';
import { FILTERS, Filter } from '../../lib/personHistory';
import { PersonRow } from './usePeople';

interface Props {
  rows: PersonRow[];
  counts: Record<Filter, number>;
  filter: Filter;
  search: string;
  selected?: string;
  twice?: PersonRow;
  loading: boolean;
  onFilter: (f: Filter) => void;
  onSearch: (s: string) => void;
  onSelect: (key: string) => void;
  onCombine: (p: PersonRow) => void;
}

export const Tags: React.FC<{ sides: string[] }> = ({ sides }) => (
  <span className="pp-tags">{sides.map(s => <span key={s} className={`pp-tag ${s}`}>{s === 'catering' ? 'Catering' : 'Sweets'}</span>)}</span>
);

const noteOf = (p: PersonRow) => {
  if (p.s.owes > 0) return { text: `Owes ${inr(p.s.owes)}`, owes: true };
  const total = p.s.catering + p.s.sweets;
  return { text: total > 0 ? inr(total) : '', owes: false };
};

// Search, filters, the "saved twice" nudge and the customer rows.
const PeopleList: React.FC<Props> = ({ rows, counts, filter, search, selected, twice, loading, onFilter, onSearch, onSelect, onCombine }) => (
  <section className="pp-list" aria-label="Customer list">
    <label className="pp-search">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B6B66" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
      <span className="pp-sr">Search customers</span>
      <input type="search" placeholder="Search name or phone" value={search} onChange={e => onSearch(e.target.value)} />
    </label>
    <div role="group" aria-label="Show" className="pp-chips">
      {FILTERS.map(f => (
        <button key={f.id} type="button" className="pp-chip" aria-pressed={filter === f.id} onClick={() => onFilter(f.id)}>{f.label} {counts[f.id]}</button>
      ))}
    </div>
    {twice && (
      <div className="pp-banner">
        <span><b>{twice.name}</b> is saved twice — {savedTwiceReason(twice)}.</span>
        <button type="button" className="ui-btn" onClick={() => onCombine(twice)}>Combine</button>
      </div>
    )}
    <div className="pp-rows">
      {loading && <div className="pp-empty">Loading customers…</div>}
      {!loading && !rows.length && <div className="pp-empty">{search ? `No one matches "${search}".` : 'No customers here yet.'}</div>}
      {rows.map(p => {
        const note = noteOf(p);
        return (
          <button key={p.key} type="button" className={`pp-row${p.key === selected ? ' on' : ''}`} aria-current={p.key === selected ? 'true' : undefined} onClick={() => onSelect(p.key)}>
            <span className="pp-av" aria-hidden="true">{initials(p.name)}</span>
            <span className="pp-row-main"><b>{p.name}</b><span>{p.s.line || p.phone || 'No bookings or bills yet'}</span></span>
            <span className="pp-row-side">
              <Tags sides={p.s.sides} />
              {note.text && <span className={`pp-note${note.owes ? ' owes' : ''}`}>{note.text}</span>}
            </span>
          </button>
        );
      })}
    </div>
  </section>
);

export default PeopleList;
