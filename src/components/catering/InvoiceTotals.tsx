import React from 'react';
import { Invoice } from '../../types';
import { summaryLines } from '../../lib/invoiceEdit';
import { TONE_COLOR } from '../money/MoneyUi';

// Side summary of the saved invoice: meals, extras, total, paid and balance.
const InvoiceTotals: React.FC<{ invoice: Invoice }> = ({ invoice }) => (
  <div className="iv-sec iv-sum" aria-label="Summary">
    {summaryLines(invoice).map(l => (
      <span key={l.k} className={[l.big ? 'big' : '', l.rule ? 'rule' : ''].join(' ')} style={l.tone ? { color: TONE_COLOR[l.tone === 'good' ? 'green' : 'red'] } : undefined}>
        <span>{l.k}</span><span>{l.v}</span>
      </span>
    ))}
  </div>
);

export default InvoiceTotals;
