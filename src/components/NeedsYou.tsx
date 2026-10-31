import React, { useMemo, useState } from 'react';
import Modal from './ui/Modal';
import { Navigate } from '../hooks/useNavIntent';
import { Quotation } from '../hooks/useQuotations';
import { needsYou, Tone } from '../lib/cateringTodo';
import { HomeNeed, homeNeeds, openChoicesOf } from '../lib/homeNeeds';
import { MoneyData, debtsOf } from '../lib/moneyView';
import { outOfStep } from '../lib/quoteSync';
import { openChoiceLabels } from '../lib/quoteChoices';
import { billDue, billPaid } from '../lib/dues';
import { isOpenPreorder, istDay } from '../lib/preorders';
import { billNumber } from '../lib/receipt';
import { formatDateIST } from '../lib/ist';
import { inr } from '../lib/money';
import { SHOP } from '../lib/shop';
import { docContext } from '../lib/docs/context';
import { useCollect } from './money/useCollect';
import { whatsApp } from './catering/InvoiceActions';
import '../styles/home.css';

const DOT: Record<Tone, string> = { red: '#C04545', amber: '#C98A1E', purple: '#6B62CF', grey: '#9A9A93' };
const PHONE_ROWS = 3;

// Everything that needs the owner today, most urgent first, each with its two buttons.
export function useHomeNeeds(d: MoneyData, quotes: Quotation[], today: string, hideTidy: boolean): HomeNeed[] {
  return useMemo(() => {
    const unpaid = d.orders.filter(o => billDue(o) > 0);
    const base = needsYou({
      bookings: d.bookings, quotes, today, invoices: d.invoices.filter(i => i.booking?.status !== 'cancelled'),
      outOfStep: outOfStep(quotes, d.bookings, today, q => openChoiceLabels(q).length > 0).length,
      unpaidBills: unpaid.map(o => ({ name: o.customer_name, total: billDue(o), at: o.created_at })),
      preorders: d.preorders.map(p => ({ name: p.customer_name, date: p.delivery_date ?? '', total: p.total_amount, advance: p.advance_paid, open: isOpenPreorder(p) })),
    });
    const byId = new Map(quotes.map(q => [q.id, q]));
    return homeNeeds(base, {
      hideTidy, choices: id => (byId.get(id) ? openChoicesOf(byId.get(id)!) : []),
      bills: unpaid.map(o => ({ no: billNumber(o.bill_no, o.id), day: istDay(o.created_at), paid: billPaid(o) })),
    });
  }, [d, quotes, today, hideTidy]);
}

interface Props { items: HomeNeed[]; data: MoneyData; quotes: Quotation[]; today: string; onNavigate: Navigate; onLater: () => void }

const askText = (name: string, day: string, total: number) => {
  const upi = docContext().settings.upi_id.trim();
  return [`Namaste ${name},`, `Your sweets pre-booking for ${formatDateIST(day, 'd MMM')} comes to ${inr(total)}.`,
    `Please send an advance to confirm it${upi ? ` (UPI: ${upi})` : ''}.`, `Thank you! ${SHOP.name}`].join('\n');
};

// Home's first card: what to do today, two buttons per row; on phones the first three, then "See all".
const NeedsYou: React.FC<Props> = ({ items, data, quotes, today, onNavigate, onLater }) => {
  const collect = useCollect(data);
  const [all, setAll] = useState(false);
  const [asking, setAsking] = useState<string | null>(null);
  const debts = useMemo(() => debtsOf(data, today), [data, today]);
  const unpaid = useMemo(() => data.orders.filter(o => billDue(o) > 0), [data.orders]);
  const quoteOf = (id: string) => quotes.find(q => q.id === id);
  const bookingOf = (id?: string | null) => data.bookings.find(b => b.id === id);
  const waiting = (day: string) => data.preorders.filter(p => p.delivery_date === day && isOpenPreorder(p) && p.advance_paid <= 0);

  const quoteMessage = (q: Quotation) => {
    const b = bookingOf(q.booking_id);
    const open = openChoicesOf(q)[0];
    const event = `${b?.event_type ?? 'event'} on ${b ? formatDateIST(b.event_date, 'd MMM') : ''}`;
    whatsApp(b?.customer?.phone, open
      ? `Namaste ${b?.customer?.name ?? ''}, for your ${event}, which ${open.label.toLowerCase()} would you like: ${open.options.join(' or ')}?\n${SHOP.name}`
      : `Namaste ${b?.customer?.name ?? ''}, just checking on quotation ${q.quotation_number} for your ${event}. Shall we go ahead?\n${SHOP.name}`);
  };

  const run = (i: HomeNeed, first: boolean) => {
    if (i.kind === 'invoice') {
      const debt = debts.find(x => x.key === i.ref);
      if (debt) (first ? collect.record : collect.remind)(debt);
    } else if (i.kind === 'bill') {
      const o = unpaid[Number(i.ref)];
      const debt = o && debts.find(x => x.key === o.id);
      if (debt) (first ? collect.record : collect.remind)(debt);
    } else if (i.kind === 'preorders') {
      if (!first) return onNavigate(i.page);
      const list = waiting(i.ref);
      if (list.length === 1) whatsApp(list[0].phone, askText(list[0].customer_name, i.ref, list[0].total_amount));
      else setAsking(i.ref);
    } else if (i.kind === 'quote') {
      const q = quoteOf(i.ref);
      if (!q) return onNavigate('quotations');
      const sent = i.first.startsWith('Follow up');
      if (first ? sent : i.second === 'WhatsApp') quoteMessage(q);
      else if (first || sent || !q.booking_id) onNavigate('quotations', { action: 'open', id: q.id });
      else onNavigate('bookings', { action: 'open', id: q.booking_id });
    } else if (first) onNavigate(i.page);
    else onLater();
  };

  const label = (long: string, short: string) => (long === short ? long : <><span className="needs-long">{long}</span><span className="needs-short">{short}</span></>);

  return (
    <section aria-label="Needs you" className={`needs-card${all ? ' all' : ''}`}>
      <div className="needs-head"><h2>Needs you</h2><span>{items.length ? 'Most urgent first' : ''}</span></div>
      {!items.length && <p className="needs-empty"><b>Nothing needs you.</b> All quotes sent, all money in.</p>}
      {items.map((i, n) => (
        <div key={i.key} className={`needs-row${n >= PHONE_ROWS ? ' extra' : ''}`}>
          <span className="needs-dot" style={{ background: DOT[i.tone] }} />
          <span className="needs-text"><b>{i.title}</b><span>{i.line}</span></span>
          <span className="needs-acts">
            <button type="button" className="ui-btn" aria-label={i.second} onClick={() => run(i, false)}>{label(i.second, i.secondShort)}</button>
            <button type="button" className="ui-btn mx-accent" aria-label={i.first} onClick={() => run(i, true)}>{label(i.first, i.firstShort)}</button>
          </span>
        </div>
      ))}
      {items.length > PHONE_ROWS && (
        <button type="button" className="mx-link hm-more" onClick={() => setAll(v => !v)} aria-expanded={all}>{all ? 'Show fewer' : `See all ${items.length} →`}</button>
      )}
      {asking && (
        <Modal title={`Ask for an advance · ${formatDateIST(asking, 'EEE d MMM')}`} onClose={() => setAsking(null)} width={440}
          footer={<button type="button" className="ui-btn primary" onClick={() => setAsking(null)}>Done</button>}>
          <div className="mx-dlg">
            <p className="mx-dlg-sub">Each opens that customer's WhatsApp with the amount.</p>
            <div className="mx-list">
              {waiting(asking).map(p => (
                <div key={p.id}>
                  <span className="mx-two-line"><b style={{ fontSize: 14 }}>{p.customer_name}</b><span>{inr(p.total_amount)} · no advance</span></span>
                  <button type="button" className="ui-btn" onClick={() => whatsApp(p.phone, askText(p.customer_name, asking, p.total_amount))}>WhatsApp</button>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}
      {collect.ui}
    </section>
  );
};

export default NeedsYou;
