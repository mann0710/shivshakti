import React from 'react';
import type { Quotation } from '../../hooks/useQuotations';
import { priceLines, youSave, Check } from '../../lib/quoteSummary';
import { inr } from '../../lib/money';
import { totalText } from '../../lib/quoteOptions';
import { SumRow } from './bits';

interface Props { q: Quotation; checks: Check[]; picks: string[]; who: string; dishPrices: boolean; onMarkSent?: () => void }

const ICON = { ok: '✓', warn: '!', bad: '✕' };

// Sticky beside the editor: the price the customer sees and "Ready to send?".
const SummaryAside: React.FC<Props> = ({ q, checks, picks, who, dishPrices, onMarkSent }) => {
  const saved = youSave(q, dishPrices);
  // The note about picks matters only when a pick changes the total.
  const moves = !!q.total_max && q.total_max > q.total_amount;
  return (
  <aside className="q-ed-side" aria-label="Summary">
    <div className="q-side-card">
      <span className="q-h">{q.option_label ? `Option ${q.option_label} · ` : ''}What the customer sees</span>
      {priceLines(q, dishPrices).map((l, i) => <SumRow key={i} k={l.k} v={l.v} tone={l.muted ? 'muted' : undefined} />)}
      <SumRow k="Total" v={totalText(q)} tone="total" />
      {saved > 0 && <span className="q-save">You save {inr(saved)}</span>}
      {picks.length > 0 && <span className="q-hint">{moves ? `Final once ${who} picks the ${picks.join(' and ').toLowerCase()}.` : `${who} picks the ${picks.join(' and ').toLowerCase()}; the price stays the same.`}</span>}
      {q.is_multi_day && <span className="q-hint">The PDF prints one block per meal with its time, guests and dishes.</span>}
    </div>
    <div className="q-side-card q-checks">
      <span className="q-h">Ready to send?</span>
      {checks.map((c, i) => <span key={i} className={`c ${c.tone}`}><i aria-hidden="true">{ICON[c.tone]}</i>{c.text}</span>)}
      {onMarkSent && <button type="button" className="q-link" onClick={onMarkSent}>Sent the PDF yourself? Mark as sent</button>}
    </div>
  </aside>
  );
};

export default SummaryAside;
