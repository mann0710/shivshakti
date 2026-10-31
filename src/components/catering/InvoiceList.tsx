import React from 'react';
import { Invoice } from '../../types';
import { inr } from '../../lib/money';
import { payState, PAY_CHIP } from '../../lib/invoiceEdit';
import { DateTile, Chip, Empty } from '../money/MoneyUi';

interface Props { title: string; invoices: Invoice[]; onOpen: (inv: Invoice) => void; empty?: React.ReactNode; collapsed?: boolean; onToggle?: () => void }

// Name, phone (3+ digits) or invoice number.
export const invoiceMatches = (inv: Invoice, q: string) => {
  const term = q.trim().toLowerCase();
  if (!term) return true;
  const digits = term.replace(/\D/g, '');
  const c = inv.booking?.customer;
  return inv.invoice_number.toLowerCase().includes(term) || (c?.name ?? '').toLowerCase().includes(term)
    || (digits.length >= 3 && (c?.phone ?? '').replace(/\D/g, '').includes(digits));
};

// A card of invoice rows; tap a row to open the invoice.
const InvoiceList: React.FC<Props> = ({ title, invoices, onOpen, empty, collapsed, onToggle }) => (
  <section aria-label={title} className="mx-card iv-group">
    <div className="mx-card-head">
      <span><b>{title} · {invoices.length}</b></span>
      {onToggle && invoices.length > 0 && <button type="button" className="mx-link" aria-expanded={!collapsed} onClick={onToggle}>{collapsed ? 'Show' : 'Hide'}</button>}
    </div>
    {!invoices.length && (empty ?? <Empty title="No invoices yet" text="Create one from a confirmed event." />)}
    {!collapsed && invoices.map(inv => {
      const st = payState(inv);
      return (
        <div key={inv.id} className="mx-row iv-row tap" role="button" tabIndex={0} onClick={() => onOpen(inv)} onKeyDown={e => e.key === 'Enter' && onOpen(inv)}>
          <DateTile iso={inv.booking?.event_date ?? inv.issue_date} />
          <span className="mx-two-line"><b>{inv.booking?.customer?.name ?? 'Customer'}{inv.booking ? ` · ${inv.booking.event_type}` : ''}</b>
            <span>{inv.invoice_number}{inv.booking?.status === 'cancelled' ? ' · booking cancelled' : ''}</span></span>
          <span className="iv-amt"><b className={inv.balance_due > 0 ? 'mx-red' : undefined}>{inr(inv.balance_due > 0 ? inv.balance_due : inv.total_amount)}</b>
            <span>{inv.balance_due > 0 ? `of ${inr(inv.total_amount)}` : 'total'}</span></span>
          <Chip bg={PAY_CHIP[st].bg} fg={PAY_CHIP[st].fg}>{st}</Chip>
        </div>
      );
    })}
  </section>
);

export default InvoiceList;
