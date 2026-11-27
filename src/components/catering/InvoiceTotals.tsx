import React from 'react';
import { Invoice } from '../../types';
import type { Quotation } from '../../hooks/useQuotations';
import { quoteToInvoice, summaryLines } from '../../lib/invoiceEdit';
import { TONE_COLOR } from '../money/MoneyUi';

// Side summary of the saved invoice: how it differs from the quote, then meals, extras, total, paid and balance.
const InvoiceTotals: React.FC<{ invoice: Invoice; quote?: Quotation }> = ({ invoice, quote }) => (
  <div className="iv-sec iv-sum" aria-label="Summary">
    {quoteToInvoice(invoice, quote).map((l, i, all) => (
      <span key={`q${l.k}`} className={i === all.length - 1 ? 'rule-after' : ''} style={{ color: '#5A5A55' }}><span>{l.k}</span><span>{l.v}</span></span>
    ))}
    {summaryLines(invoice).map(l => (
      <span key={l.k} className={[l.big ? 'big' : '', l.rule ? 'rule' : ''].join(' ')} style={l.tone ? { color: TONE_COLOR[l.tone === 'good' ? 'green' : 'red'] } : undefined}>
        <span>{l.k}</span><span>{l.v}</span>
      </span>
    ))}
  </div>
);

export default InvoiceTotals;
