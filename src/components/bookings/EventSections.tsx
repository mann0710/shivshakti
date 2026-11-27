import React from 'react';
import { Invoice } from '../../types';
import { Quotation } from '../../hooks/useQuotations';
import { optionTitle, plateText, statusText, totalText } from '../../lib/quoteOptions';
import { inr } from '../../lib/money';
import { MoneyRow, openGroups } from './eventFacts';
import { eventMenu, PickLine } from '../../lib/eventMenu';
import '../../styles/bookings-dialogs.css';

// The event page's blocks: quotations, menu, invoice, payments and money.
export const Section: React.FC<{ title: string; action?: React.ReactNode; children: React.ReactNode }> = ({ title, action, children }) => (
  <section className="ev-sec" aria-label={title}>
    <span className="ev-head">{title}{action && <> · {action}</>}</span>
    {children}
  </section>
);

interface Act { label: string; onClick: () => void }
interface RowProps { title: string; sub?: string; right?: string; tone?: 'due' | 'done'; acts?: Act[] }

const Row: React.FC<RowProps> = ({ title, sub, right, tone, acts }) => (
  <div className="ev-row">
    <span><b>{title}</b>{sub && <small>{sub}</small>}</span>
    <span className={`ev-right${tone ? ` ${tone}` : ''}`}>{right}</span>
    {acts && acts.length > 0 && (
      <span className="ev-acts">{acts.map(a => <button key={a.label} type="button" className="ev-act" onClick={a.onClick}>{a.label}</button>)}</span>
    )}
  </div>
);

// "South Boll or Mix Bhajiya" while a pick is open, else the option, plate price or multi-day.
const quoteLine = (q: Quotation) => {
  const open = openGroups(q).map(g => g.items.map(i => i.item_name).join(' or '));
  if (open.length) return open.join(' · ');
  return [optionTitle(q), q.per_plate_amount > 0 ? `${plateText(q)} a plate` : q.is_multi_day ? 'Multi-day menu' : ''].filter(Boolean).join(' · ');
};

interface QuotesProps {
  quotes: Quotation[];
  live: boolean;
  canAccept: (q: Quotation) => boolean;
  onNew: () => void;
  onEdit: (q: Quotation) => void;
  onSend: (q: Quotation) => void;
  onAccept: (q: Quotation) => void;
}

export const EventQuotes: React.FC<QuotesProps> = ({ quotes, live, canAccept, onNew, onEdit, onSend, onAccept }) => (
  <Section title="Quotations" action={live ? <button type="button" className="ev-add" onClick={onNew}>+ New quote</button> : undefined}>
    <div className="ev-list">
      {quotes.length === 0 ? <div className="ev-empty">No quotation yet</div> : quotes.map(q => (
        <Row key={q.id} title={`${q.quotation_number} · ${statusText(q).toLowerCase()}`} sub={quoteLine(q)} right={totalText(q)}
          acts={[
            { label: 'Edit', onClick: () => onEdit(q) },
            { label: 'Send', onClick: () => onSend(q) },
            ...(canAccept(q) ? [{ label: 'Confirm booking', onClick: () => onAccept(q) }] : []),
          ]} />
      ))}
    </div>
  </Section>
);

const pickText = (p: PickLine) => `${p.label}: ${p.chosen.length ? p.chosen.join(', ') : `not chosen yet (${p.options.join(' or ')})`}`;

// The booked menu with what the customer chose; open picks show in red until decided.
export const EventMenu: React.FC<{ quote?: Quotation; onPdf: () => void }> = ({ quote, onPdf }) => {
  const blocks = eventMenu(quote);
  return (
    <Section title={quote ? `Menu · ${quote.quotation_number}` : 'Menu'} action={quote ? <button type="button" className="ev-add" onClick={onPdf}>Kitchen PDF</button> : undefined}>
      {blocks.length === 0 ? <div className="ev-list"><div className="ev-empty">No menu yet. It comes from the quotation.</div></div> : blocks.map((b, n) => (
        <div className="ev-list" key={b.title || n}>
          {b.title && <div className="ev-menu-h">{b.title}</div>}
          {b.picks.length > 0 && (
            <div className="ev-row">
              <span><b>Customer's choice</b>{b.picks.map(p => <small key={p.label + p.options.join()} className={p.chosen.length ? undefined : 'ev-open'}>{p.chosen.length ? '✓ ' : ''}{pickText(p)}</small>)}</span>
            </div>
          )}
          {b.courses.length === 0 ? <div className="ev-empty">Menu to be decided</div> : b.courses.map(c => (
            <div className="ev-row" key={c.name}><span><b>{c.name}</b><small className={c.open ? 'ev-open' : undefined}>{c.dishes.join(' · ')}</small></span></div>
          ))}
        </div>
      ))}
    </Section>
  );
};

const invoiceState = (i: Invoice) => (Number(i.balance_due) <= 0 ? 'paid' : Number(i.advance_paid) > 0 ? 'part paid' : i.status);

export const EventInvoice: React.FC<{ invoice: Invoice; onOpen: () => void; onSend: () => void; onPay: () => void }> = ({ invoice: i, onOpen, onSend, onPay }) => {
  const due = Number(i.balance_due) || 0;
  return (
    <Section title="Invoice">
      <div className="ev-list">
        <Row title={`${i.invoice_number} · ${invoiceState(i)}`} sub={`Total ${inr(i.total_amount)}`}
          right={due > 0 ? `${inr(due)} due` : `${inr(i.total_amount)} paid`} tone={due > 0 ? 'due' : 'done'}
          acts={[{ label: 'Open', onClick: onOpen }, { label: 'Send', onClick: onSend }, ...(due > 0 ? [{ label: 'Record payment', onClick: onPay }] : [])]} />
      </div>
    </Section>
  );
};

export interface PayLine { key: string; title: string; sub: string; amount: number; onEdit?: () => void }

export const EventPayments: React.FC<{ lines: PayLine[] }> = ({ lines }) => (
  <Section title="Payments">
    <div className="ev-list">{lines.map(p => <Row key={p.key} title={p.title} sub={p.sub} right={inr(p.amount)} tone={p.amount < 0 ? 'due' : undefined} acts={p.onEdit ? [{ label: 'Edit', onClick: p.onEdit }] : undefined} />)}</div>
  </Section>
);

export const MoneySummary: React.FC<{ rows: MoneyRow[] }> = ({ rows }) => (
  <Section title="Money">
    <div className="ev-money">
      {rows.map(r => <span key={r.label} className={r.strong ? 'strong' : undefined}><span>{r.label}</span><span>{r.value}</span></span>)}
    </div>
  </Section>
);
