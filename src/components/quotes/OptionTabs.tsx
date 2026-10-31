import React from 'react';
import type { Quotation } from '../../hooks/useQuotations';
import { compareRows } from '../../lib/quoteSummary';
import { nextLabel, totalText } from '../../lib/quoteOptions';

interface Props {
  current: Quotation;
  options: Quotation[];
  enabled: boolean;
  saved: boolean;
  compare: boolean;
  busy: boolean;
  name: string;
  onName: (v: string) => void;
  onSwitch: (q: Quotation) => void;
  onAdd: () => void;
  onCompare: (on: boolean) => void;
}

// Option tabs A · B · C, "+ Add option" (a copy of the open one) and Compare.
const OptionTabs: React.FC<Props> = ({ current, options, enabled, saved, compare, busy, name, onName, onSwitch, onAdd, onCompare }) => {
  if (!enabled) return null;
  const many = options.length > 1;
  const me = current.option_label || 'A';
  const next = nextLabel(many ? options : [{ ...current, option_label: 'A' }]);
  return (
    <div className="q-otabs-wrap">
      <div role="tablist" aria-label="Options" className="q-otabs">
        {(many ? options : [current]).map(o => {
          const on = !compare && o.id === current.id;
          return (
            <button key={o.id} type="button" role="tab" aria-selected={on} className={`q-otab${on ? ' on' : ''}`} onClick={() => (on ? undefined : onSwitch(o))}>
              <b>Option {o.option_label || 'A'}</b>{o.option_name ? ` · ${o.option_name}` : ''} <span className="p">· {totalText(o)}</span>
            </button>
          );
        })}
        {many && <button type="button" role="tab" aria-selected={compare} className={`q-otab${compare ? ' on' : ''}`} onClick={() => onCompare(true)}>Compare</button>}
        <button type="button" className="q-otab add" disabled={!saved || busy} title={saved ? undefined : 'Make a change first — the quote saves, then it can be copied'} onClick={onAdd}>
          {busy ? 'Adding…' : `+ Add option ${next} (starts as a copy of ${me})`}
        </button>
      </div>
      {many && !compare && (
        <label className="q-optname">Name of option {me}
          <input value={name} onChange={e => onName(e.target.value)} placeholder="e.g. Royal, Classic, Simple" />
        </label>
      )}
    </div>
  );
};

// Options side by side; rows that differ are shaded.
export const CompareTable: React.FC<{ options: Quotation[] }> = ({ options }) => (
  <div className="q-compare">
    <table>
      <thead><tr><th />{options.map(o => <th key={o.id}>{o.option_label}{o.option_name ? ` · ${o.option_name}` : ''}</th>)}</tr></thead>
      <tbody>
        {compareRows(options).map(r => (
          <tr key={r.label} className={`${r.differs ? 'diff' : ''}${r.strong ? ' strong' : ''}`}>
            <th scope="row">{r.label}</th>
            {r.cells.map((c, i) => <td key={i}>{c}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
    <p className="q-hint q-pad">"+ Add option" starts as a copy of the open one, so you only change what differs. Each option keeps its own guests, extras and payment plan.</p>
  </div>
);

export default OptionTabs;
