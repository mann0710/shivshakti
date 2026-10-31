import React from 'react';
import type { Quotation } from '../../hooks/useQuotations';
import { BoardRow, shortPrice, optionLine } from '../../lib/quoteBoard';
import { groupTotal } from '../../lib/quoteGroups';
import { totalText } from '../../lib/quoteOptions';
import { formatDateIST } from '../../lib/ist';
import QuoteMenu, { QuoteActions } from './QuoteMenu';
import { DateChip, Letter, StatusChip } from './bits';

interface Props {
  r: BoardRow;
  a: QuoteActions;
  selected: boolean;
  folded: boolean;
  onSelect: (r: BoardRow) => void;
  onFold: (key: string) => void;
}

const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Runs the row's one next step.
export const runNext = (r: BoardRow, a: QuoteActions) => {
  const all = r.group.grouped ? r.group.options : undefined;
  if (!r.next) return;
  if (r.next.kind === 'send') a.send(r.head, all);
  else if (r.next.kind === 'invoice') a.invoice(r.head);
  else a.accept(r.head);
};

// One enquiry: a plain quote, or options A / B / C folded under one line.
const QuoteRow: React.FC<Props> = ({ r, a, selected, folded, onSelect, onFold }) => {
  const g = r.group;
  const who = r.name.split(' · ')[0];
  const phoneSub = [r.flag ? capFirst(r.flag) : '', r.flag ? '' : r.head.quotation_number].filter(Boolean).join(' · ');
  const chip = r.section === 'waiting' ? <StatusChip q={r.head} text={g.grouped ? 'Waiting' : 'Sent'} />
    : g.grouped ? <span className="q-chip warn">{g.options.length} options</span> : null;
  const option = (o: Quotation) => {
    const lost = g.options.some(x => x.status === 'accepted') && o.status !== 'accepted';
    return (
      <div key={o.id} className={`q-opt${lost ? ' lost' : ''}`} onClick={() => onSelect(r)}>
        <span className="rail" aria-hidden="true" />
        <Letter l={o.option_label} />
        <span className="q-txt">
          <b><span className="q-ph">{o.option_label} · </span>{o.option_name || `Option ${o.option_label}`}</b>
          <span className="q-line">{optionLine(o)}{lost ? ' · not chosen' : o.status === 'accepted' ? ' · chosen' : ''}</span>
        </span>
        <b className="q-amt">{totalText(o)}</b>
        <span className="q-opt-acts">
          <button type="button" className="q-plain" onClick={e => { e.stopPropagation(); a.open(o); }}>Open</button>
          <button type="button" className="q-plain" onClick={e => { e.stopPropagation(); a.pdf(o); }} aria-label={`PDF of option ${o.option_label}`}>PDF</button>
        </span>
      </div>
    );
  };

  return (
    <>
      <div className={`q-row${selected ? ' on' : ''}`} onClick={() => onSelect(r)}>
        <DateChip iso={r.date} />
        <span className="q-txt">
          <span className="q-name">
            <button type="button" className="q-namebtn" onClick={e => { e.stopPropagation(); onSelect(r); }}>
              <span className="q-dk">{r.name}</span>
              <span className="q-ph">{who}{r.date ? ` · ${formatDateIST(r.date, 'd MMM')}` : ''}</span>
            </button>
            {g.grouped && (
              <button type="button" className="q-fold" aria-expanded={!folded} onClick={e => { e.stopPropagation(); onFold(g.key); }}>
                {g.options.length} options {folded ? '▸' : '▾'}
              </button>
            )}
          </span>
          <span className="q-line q-dk">{r.line}{r.flag && <> · <b className={`q-flag ${r.flagTone}`}>{r.flag}</b></>}</span>
          <span className={`q-line q-ph${r.flagTone === 'bad' ? ' bad' : ''}`}>{phoneSub}</span>
        </span>
        <span className="q-right">
          <b className="q-amt q-dk">{groupTotal(g)}</b>
          <span className="q-ph q-phright"><b className="q-amt">{shortPrice(g)}</b>{chip}</span>
          {r.next && (
            <button type="button" className={r.next.kind === 'send' ? 'q-plain q-dk' : 'q-next q-dk'} onClick={e => { e.stopPropagation(); runNext(r, a); }}>{r.next.label}</button>
          )}
          <span className="q-dk"><QuoteMenu g={g} q={r.head} a={a} /></span>
        </span>
      </div>
      {g.grouped && !folded && g.options.map(option)}
    </>
  );
};

export default QuoteRow;
