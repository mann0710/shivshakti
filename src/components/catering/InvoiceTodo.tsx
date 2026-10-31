import React, { useState } from 'react';
import { Invoice } from '../../types';
import { Ready, Owing } from '../../lib/cateringTodo';
import { inr } from '../../lib/money';
import { formatDateIST } from '../../lib/ist';
import { statusLabel } from '../StatusPill';
import { DateTile, Chip } from '../money/MoneyUi';
import { payState, PAY_CHIP } from '../../lib/invoiceEdit';

interface Props {
  owing: Owing[];
  ready: Ready[];
  past: Ready[];
  pastValue: number;
  invoices: Invoice[];
  onOpen: (inv: Invoice) => void;
  onPay: (inv: Invoice) => void;
  onCreate: (bookingId: string) => void;
  onSettle: (r: Ready) => void;
  onSettleAll: () => void;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const meals = (inv: Invoice) => {
  const days = (inv.event_days ?? []) as any[];
  const count = days.reduce((s, d) => s + (d.meals?.length ?? 0), 0);
  const guests = days.reduce((s, d) => s + Math.max(0, ...(d.meals ?? []).map((m: any) => Number(m.guest_count) || 0)), 0) || inv.booking?.guest_count || 0;
  return [count > 1 ? `${count} meals` : '', guests ? `${guests} guests` : ''].filter(Boolean).join(', ');
};

// Invoices page groups: waiting for money, ready to invoice, past events with no invoice.
const InvoiceTodo: React.FC<Props> = ({ owing, ready, past, pastValue, invoices, onOpen, onPay, onCreate, onSettle, onSettleAll }) => {
  const byId = new Map(invoices.map(i => [i.id, i]));
  const [showPast, setShowPast] = useState(false);
  const readyRow = (r: Ready, action: string, run: () => void, past = false) => (
    <div key={r.booking.id} className="mx-row iv-row tap" role="button" tabIndex={0} aria-label={`${action}: ${r.booking.customer?.name ?? 'Customer'}`}
      onClick={run} onKeyDown={e => e.key === 'Enter' && run()}>
      <DateTile iso={r.booking.event_date} />
      <span className="mx-two-line"><b>{r.booking.customer?.name ?? 'Customer'} · {r.booking.event_type}</b>
        <span className={!r.booking.guest_count && !past ? 'mx-red' : undefined}>
          {[past ? cap(statusLabel(r.booking.status)) : '', past && r.booking.guest_count ? `${r.booking.guest_count} guests` : '',
            r.quote?.quotation_number ?? 'No quote', !r.booking.guest_count && !past ? 'guest count missing' : ''].filter(Boolean).join(' · ')}
        </span></span>
      <span className="iv-amt"><b>{inr(r.quote?.total_amount ?? 0)}</b><span>{past ? 'quoted' : 'from the quote'}</span></span>
      <button type="button" className="ui-btn" onClick={e => { e.stopPropagation(); run(); }}>{action}</button>
    </div>
  );
  return (
    <>
      <section aria-label="Waiting for money" className="mx-card iv-group">
        <div className="mx-card-head"><span><b>Waiting for money · {owing.length}</b><span className="mx-sub">Oldest first</span></span></div>
        {!owing.length && <p className="mx-empty">Nothing waiting. Every invoice is paid.</p>}
        {owing.map(o => {
          const inv = byId.get(o.invoice.id)!;
          const st = payState(inv);
          return (
            <div key={inv.id} className="mx-row iv-row tap" role="button" tabIndex={0} onClick={() => onOpen(inv)} onKeyDown={e => e.key === 'Enter' && onOpen(inv)}>
              <DateTile iso={inv.booking?.event_date ?? inv.issue_date} />
              <span className="mx-two-line"><b>{inv.booking?.customer?.name ?? 'Customer'}{inv.booking ? ` · ${inv.booking.event_type}` : ''}</b>
                <span>{[inv.invoice_number, meals(inv), `issued ${formatDateIST(inv.issue_date, 'd MMM')}`, o.days > 0 ? `${o.days} days since the event` : 'event not yet'].filter(Boolean).join(' · ')}</span></span>
              <span className="iv-amt"><b className="mx-red">{inr(inv.balance_due)}</b>
                <span className="mn-desk-only">of {inr(inv.total_amount)} · {inr(inv.advance_paid)} paid</span>
                <span className="mn-phone-only"><Chip bg={PAY_CHIP[st].bg} fg={PAY_CHIP[st].fg}>{st}</Chip></span></span>
              <button type="button" className="ui-btn mx-accent" onClick={e => { e.stopPropagation(); onPay(inv); }}>Record payment</button>
            </div>
          );
        })}
      </section>

      <section aria-label="Ready to invoice" className="mx-card iv-group">
        <div className="mx-card-head"><span><b>Ready to invoice · {ready.length}</b><span className="mx-sub">Confirmed events with an accepted quote</span></span></div>
        {!ready.length && <p className="mx-empty">No confirmed events are waiting for an invoice.</p>}
        {ready.map(r => readyRow(r, 'Create invoice', () => onCreate(r.booking.id)))}
      </section>

      {past.length > 0 && (
        <section aria-label="Past events with no invoice" className={`mx-card iv-group iv-past${showPast ? ' open' : ''}`}>
          <div className="mx-card-head">
            <span><b>Past events with no invoice · {past.length}</b><span className="mx-sub">Were these paid outside the app? Mark them so Money adds up. {inr(pastValue)} quoted.</span></span>
            <button type="button" className="mx-link" onClick={onSettleAll}>Mark all {past.length} as settled outside</button>
          </div>
          <button type="button" className="mx-row iv-row iv-past-sum" aria-expanded={showPast} onClick={() => setShowPast(v => !v)}>
            <span className="mx-two-line"><b>{past.length} events · {inr(pastValue)} quoted</b><span>Paid outside the app? Settle them so Money adds up</span></span>
            <b>{showPast ? 'Hide' : 'Review'}</b>
          </button>
          {past.map(r => readyRow(r, 'Invoice or settle', () => onSettle(r), true))}
        </section>
      )}
    </>
  );
};

export default InvoiceTodo;
