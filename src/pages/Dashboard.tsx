import React, { useMemo, useState } from 'react';
import NeedsYou, { useHomeNeeds } from '../components/NeedsYou';
import { Navigate } from '../hooks/useNavIntent';
import { useBookingValue } from '../hooks/useBookingValue';
import { useStoredState } from '../hooks/useStoredState';
import { getISTGreeting, formatDateIST, todayIST } from '../lib/ist';
import { inr } from '../lib/money';
import { bookingView } from '../lib/bookingBoard';
import { openChoiceLabels } from '../lib/quoteChoices';
import { billDue } from '../lib/dues';
import { istDay } from '../lib/preorders';
import { billNumber } from '../lib/receipt';
import { awaitsAcceptance, comingIn, debtsOf, receiptsIn, sumOf, MODE_NAME } from '../lib/moneyView';
import { Stage } from '../lib/eventStage';
import { eventNote, nextDays, sweetsWeek, niceDay } from '../lib/homeNeeds';
import { posLink } from '../lib/posIntent';
import { useMoneyData } from '../components/money/useMoneyData';
import { Tile, LoadError, Skeleton, useNow, istClock } from '../components/money/MoneyUi';
import { NextEvents, SweetsWeek, NewSheet } from '../components/money/HomeCards';
import '../styles/home.css';

interface Props { onNavigate: Navigate }

// Home: what needs you today, the money and events at a glance, and this week's sweets.
const Dashboard: React.FC<Props> = ({ onNavigate }) => {
  const { data, quotes, loading, error, retry } = useMoneyData();
  const valueOf = useBookingValue();
  const now = useNow();
  const today = todayIST();
  const [later, setLater] = useStoredState<{ tidy: string }>('shivshakti.homeLater', () => ({ tidy: '' }));
  const [newOpen, setNewOpen] = useState(false);
  const needs = useHomeNeeds(data, quotes, today, later.tidy === today);

  const home = useMemo(() => {
    const debts = debtsOf(data, today);
    const month = receiptsIn(data, { from: `${today.slice(0, 7)}-01`, to: today });
    const last = receiptsIn(data, { from: '2000-01-01', to: today })[0];
    const upcoming = data.bookings.filter(b => b.status !== 'cancelled' && b.event_date >= today).sort((a, b) => a.event_date.localeCompare(b.event_date));
    const events = upcoming.slice(0, 5).map(b => {
      const view = bookingView(b, { quotes, invoices: data.invoices, value: valueOf(b), today });
      const pick = view.quote && view.quote.status !== 'accepted' ? openChoiceLabels(view.quote)[0] : undefined;
      const hasDraft = quotes.some(q => q.booking_id === b.id && q.status === 'draft');
      const live = quotes.some(q => q.booking_id === b.id && (q.status === 'sent' || q.status === 'accepted'));
      // A draft quote is still an inquiry; a sent quote waiting on a pick is still quoted.
      const stage: Stage = awaitsAcceptance(b.id, quotes) ? 'quoted' : view.stage === 'quoted' && !live ? 'inquiry' : view.stage;
      return { view, stage, note: eventNote({ stage, guests: b.guest_count, time: b.event_time, pick, hasDraft, valueText: view.valueText }) };
    });
    const unpaid = data.orders.filter(o => billDue(o) > 0)
      .map(o => ({ id: o.id, name: o.customer_name, no: billNumber(o.bill_no, o.id), day: istDay(o.created_at), items: o.items.length, due: billDue(o) }));
    return {
      debts, month: sumOf(month, x => x.amount), last, events, next: nextDays(data.bookings, today), first: upcoming[0],
      coming: comingIn(data, today), sweets: sweetsWeek(data.preorders, unpaid, today).slice(0, 6),
    };
  }, [data, quotes, today, valueOf]);

  const by = (kind: 'invoice' | 'sweets') => sumOf(home.debts.filter(d => (kind === 'invoice') === (d.kind === 'invoice')), d => d.amount);
  const owed = sumOf(home.debts, d => d.amount);
  const sent = home.coming.sent;
  const quoteNote = [sent.count ? `${sent.names[0]} ${inr(sent.low)}${sent.high > sent.low ? '+' : ''}` : '', `${home.coming.drafts.count} draft${home.coming.drafts.count === 1 ? '' : 's'} to send`].filter(Boolean).join(' · ');
  const things = `${needs.length} thing${needs.length === 1 ? '' : 's'} need${needs.length === 1 ? 's' : ''} you`;

  return (
    <div className="mx-page hm-page">
      <div className="mx-head hm-head">
        <div className="mx-head-l">
          <h1>{getISTGreeting()}</h1>
          <span className="hm-sub">
            <span className="mx-wide-inline">{formatDateIST(today, 'EEEE, d MMM yyyy')} · {istClock(now)} · </span>
            <span className="mx-narrow-inline">{formatDateIST(today, 'EEE d MMM')} · </span>
            {loading ? 'loading…' : things}
          </span>
        </div>
        <div className="mx-head-r hm-actions-desk">
          <button type="button" className="ui-btn" onClick={() => onNavigate('seasonal_billing', posLink.bill())}>Sweets bill</button>
          <button type="button" className="ui-btn" onClick={() => onNavigate('quotations', { action: 'new' })}>New quotation</button>
          <button type="button" className="ui-btn primary" onClick={() => onNavigate('bookings', { action: 'new' })}>+ New booking</button>
        </div>
        <button type="button" className="ui-btn primary hm-new" onClick={() => setNewOpen(true)}>+ New</button>
      </div>

      {error && <LoadError onRetry={retry} />}
      {loading ? <><Skeleton rows={4} /><Skeleton rows={2} /></> : (
        <>
          <div className="mx-tiles hm-tiles-phone">
            <Tile label="To collect" value={inr(owed)} tone="red" onClick={() => onNavigate('finance')} />
            <Tile label="Next event" value={home.first ? niceDay(home.first.event_date) : 'None'} onClick={() => onNavigate('bookings', home.first ? { action: 'open', id: home.first.id } : undefined)} />
          </div>
          <NeedsYou items={needs} data={data} quotes={quotes} today={today} onNavigate={onNavigate} onLater={() => setLater({ tidy: today })} />
          <div className="mx-tiles hm-tiles-desk">
            <Tile label="To collect" value={inr(owed)} tone="red" note={`Catering ${inr(by('invoice'))} · sweets ${inr(by('sweets'))}`} onClick={() => onNavigate('finance')} />
            <Tile label={`Received in ${formatDateIST(today, 'MMMM')}`} value={inr(home.month)} onClick={() => onNavigate('finance', { action: 'open', id: 'month' })}
              note={home.last ? `Last: ${inr(home.last.amount)} ${MODE_NAME[home.last.mode].toLowerCase()} on ${niceDay(home.last.day)}` : 'Nothing received yet'} />
            <Tile label="Next 30 days" value={`${home.next.count} event${home.next.count === 1 ? '' : 's'}`} onClick={() => onNavigate('bookings')}
              note={home.next.count ? `${home.next.guests} guests · ${home.next.daysText}` : 'No events booked'} />
            <Tile label="Quotes" value={`${sent.count} waiting`} tone="purple" note={quoteNote} onClick={() => onNavigate('quotations')} />
          </div>
          <div className="hm-two">
            <NextEvents rows={home.events} onNavigate={onNavigate} />
            <SweetsWeek rows={home.sweets} onNavigate={onNavigate} />
          </div>
        </>
      )}
      {newOpen && <NewSheet onNavigate={onNavigate} onClose={() => setNewOpen(false)} />}
    </div>
  );
};

export default Dashboard;
