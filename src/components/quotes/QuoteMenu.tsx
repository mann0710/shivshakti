import React, { useRef, useState } from 'react';
import type { Quotation } from '../../hooks/useQuotations';
import type { QuoteGroup } from '../../lib/quoteGroups';
import { nextLabel } from '../../lib/quoteOptions';
import Popover from './Popover';

// Everything the list can do to a quote; one place so rows, the panel and the menu agree.
export interface QuoteActions {
  open: (q: Quotation) => void;
  send: (q: Quotation, options?: Quotation[]) => void;
  pdf: (q: Quotation, options?: Quotation[]) => void;
  accept: (q: Quotation, picks?: Set<string>) => void;
  duplicate: (q: Quotation) => void;
  addOption: (q: Quotation) => void;
  savePackage: (q: Quotation) => void;
  setStatus: (q: Quotation, status: 'draft' | 'sent' | 'rejected') => void;
  remove: (q: Quotation) => void;
  invoice: (q: Quotation) => void;
}

interface Props { g: QuoteGroup; q: Quotation; a: QuoteActions; size?: 'row' | 'opt' }

// "⋯" on a quote row: the less common actions.
const QuoteMenu: React.FC<Props> = ({ g, q, a, size = 'row' }) => {
  const btn = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const all = g.grouped ? g.options : undefined;
  const live = !g.options.some(o => o.status === 'accepted');
  const item = (label: string, run: () => void, danger = false) => (
    <button type="button" role="menuitem" className={danger ? 'danger' : ''} onClick={() => { setOpen(false); run(); }}>{label}</button>
  );
  return (
    <>
      <button ref={btn} type="button" className={size === 'row' ? 'q-dots' : 'q-dots sm'} aria-haspopup="menu" aria-expanded={open}
        aria-label={`More for ${q.customer?.name ?? q.quotation_number}`} onClick={e => { e.stopPropagation(); setOpen(o => !o); }}>⋯</button>
      {open && (
        <Popover anchor={btn.current} label={`Actions for ${q.quotation_number}`} role="menu" width={240} onClose={() => setOpen(false)}>
          <div className="q-menu">
            {item('Open', () => a.open(q))}
            {item('Send…', () => a.send(q, size === 'row' ? all : undefined))}
            {item('Download PDF', () => a.pdf(q, size === 'row' ? all : undefined))}
            <hr />
            {item('Duplicate', () => a.duplicate(q))}
            {live && item(`Add option ${nextLabel(g.grouped ? g.options : [{ ...q, option_label: 'A' }])}`, () => a.addOption(q))}
            {!q.is_multi_day && (q.items ?? []).length > 0 && item('Save menu as package', () => a.savePackage(q))}
            <hr />
            {q.status === 'draft' && item('Mark sent', () => a.setStatus(q, 'sent'))}
            {(q.status === 'draft' || q.status === 'sent') && item('Mark lost', () => a.setStatus(q, 'rejected'))}
            {q.status === 'rejected' && item('Reopen', () => a.setStatus(q, 'sent'))}
            {item('Delete quote…', () => a.remove(q), true)}
          </div>
        </Popover>
      )}
    </>
  );
};

export default QuoteMenu;
