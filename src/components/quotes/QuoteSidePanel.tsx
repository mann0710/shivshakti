import React, { useEffect, useMemo, useState } from 'react';
import { BoardRow, quoteHistory, lostWhy } from '../../lib/quoteBoard';
import { priceLines } from '../../lib/quoteSummary';
import { groupTotal } from '../../lib/quoteGroups';
import { totalText, quoteGuests } from '../../lib/quoteOptions';
import { choiceGroups, pickedOf, acceptPatch, pickKey } from '../../lib/quoteChoices';
import { formatDateIST } from '../../lib/ist';
import { inr } from '../../lib/money';
import { fmtTime } from '../catering/BookingCalendar';
import QuoteMenu, { QuoteActions } from './QuoteMenu';
import { runNext } from './QuoteRow';
import { Letter, StatusChip, SumRow, useMedia, PHONE } from './bits';

interface Props { r: BoardRow; a: QuoteActions; today: string }

// The selected quote: price, the customer's open choice, actions and what happened so far.
const QuoteSidePanel: React.FC<Props> = ({ r, a, today }) => {
  const g = r.group;
  const q = r.head;
  const b = q.booking;
  // Phones hide the row's ⋯, so the panel carries it.
  const phone = useMedia(PHONE);
  // One open "choose 1" group can be decided right here.
  const open = useMemo(() => (q.is_multi_day ? [] : choiceGroups(q.items).filter(x => !pickedOf(x).length)), [q]);
  const single = r.section === 'waiting' && !g.grouped && open.length === 1 && Math.max(1, open[0].meta.pick) === 1 ? open[0] : null;
  const [pick, setPick] = useState('');
  useEffect(() => { setPick(single?.items[0]?.item_id ?? ''); }, [single]);
  const totalWith = (itemId: string) => acceptPatch(q, new Set([pickKey(itemId)])).total_amount ?? q.total_amount;
  const meta = [b?.event_type, b?.event_date && formatDateIST(b.event_date, 'EEE d MMM'), fmtTime(b?.event_time),
    quoteGuests(q) ? `${quoteGuests(q)} guests` : '', q.food_type].filter(Boolean).join(' · ');

  return (
    <div className="q-panel">
      <div className="q-panel-head">
        <span className="q-chips-line">
          <span className="q-num">{q.quotation_number}</span>
          <StatusChip q={q} text={r.section === 'lost' ? (lostWhy(g, today) === 'expired' ? 'Expired' : 'Declined') : undefined} />
          {r.flag && <span className={`q-chip ${r.flagTone === 'bad' ? 'lost' : 'warn'}`}>{r.flag.charAt(0).toUpperCase() + r.flag.slice(1)}</span>}
        </span>
        <h2>{q.customer?.name || 'Customer'}</h2>
        {meta && <span className="q-panel-meta">{meta}</span>}
      </div>

      {g.grouped ? (
        <div className="q-sum">
          {g.options.map(o => (
            <span key={o.id} className={`r opt${o.status === 'rejected' ? ' muted' : ''}`}>
              <span><Letter l={o.option_label} /> {o.option_name || `Option ${o.option_label}`}</span><b>{totalText(o)}</b>
            </span>
          ))}
          <SumRow k="Range" v={groupTotal(g)} tone="total" />
        </div>
      ) : (
        <div className="q-sum">
          {priceLines(q).map((l, i) => <SumRow key={i} k={l.k} v={l.v} tone={l.muted ? 'muted' : undefined} />)}
          <SumRow k="Total" v={totalText(q)} tone="total" />
        </div>
      )}

      {single ? (
        <div className="q-pickbox" role="radiogroup" aria-label={`${single.meta.label} — customer picks 1`}>
          <b>{single.meta.label} — customer picks 1</b>
          {single.items.map(i => (
            <label key={i.item_id}>
              <span><input type="radio" name="panel-pick" checked={pick === i.item_id} onChange={() => setPick(i.item_id)} /> {i.item_name}{i.served_with ? ` + ${i.served_with}` : ''}</span>
              <span className="muted">{inr(totalWith(i.item_id))}</span>
            </label>
          ))}
          <button type="button" className="ui-btn primary" onClick={() => a.accept(q, new Set([pickKey(pick)]))}>Accept with this {single.meta.label.toLowerCase()}</button>
        </div>
      ) : r.next && (
        <button type="button" className={`ui-btn${r.next.kind === 'send' ? '' : ' primary'}`} onClick={() => runNext(r, a)}>{r.next.label}</button>
      )}

      <div className="q-acts" style={phone ? { gridTemplateColumns: 'repeat(3, minmax(0, 1fr)) 44px' } : undefined}>
        <button type="button" className="ui-btn" onClick={() => a.send(q, g.grouped ? g.options : undefined)}>WhatsApp</button>
        <button type="button" className="ui-btn" onClick={() => a.pdf(q, g.grouped ? g.options : undefined)}>PDF</button>
        <button type="button" className="ui-btn" onClick={() => a.open(q)}>Edit</button>
        {phone && <QuoteMenu g={g} q={q} a={a} />}
      </div>

      <div className="q-hist">
        <span className="q-h">History</span>
        {quoteHistory(r, today).map((h, i) => <span key={i} className="h"><span className="w">{h.when}</span><span>{h.what}</span></span>)}
      </div>
    </div>
  );
};

export default QuoteSidePanel;
