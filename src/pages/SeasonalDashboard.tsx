import React, { useMemo, useState } from 'react';
import { useSeasonalOrders } from '../hooks/useSeasonalOrders';
import { useSeasonalPreorders } from '../hooks/useSeasonalPreorders';
import { useSeasonalOccasions } from '../hooks/useSeasonalOccasions';
import { useSeasonalItems } from '../hooks/useSeasonalItems';
import { Navigate } from '../hooks/useNavIntent';
import { summarize, shopDay, dayStart } from '../lib/dayClose';
import { occasionOn, seasonBanner } from '../lib/occasions';
import { addDays, bookedOf, dueList, makePlan, seasonSoFar, unpaidOf } from '../lib/sweetsToday';
import { todayIST } from '../lib/ist';
import { inr } from '../lib/money';
import { posLink } from '../lib/posIntent';
import DueList from '../components/sweets/DueList';
import MakeList from '../components/sweets/MakeList';
import SeasonSoFar from '../components/sweets/SeasonSoFar';
import ChangeSeasonModal from '../components/sweets/ChangeSeasonModal';
import '../styles/sweets.css';

interface Props { onNavigate: Navigate }

const IST = 'Asia/Kolkata';
const OPEN_HOUR = 4; // the shop day runs 4 am to 4 am, as on the day close
const DUE_ROWS = 6;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const clock = (d: Date, long: boolean) => {
  const day = d.toLocaleDateString('en-IN', { weekday: long ? 'long' : 'short', day: 'numeric', month: 'short', timeZone: IST });
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: IST }).toUpperCase();
  return `${day}, ${time}`;
};

const Tile: React.FC<{ label: string; value: string; note: string; tone?: 'bad' | 'warm'; className?: string }> = ({ label, value, note, tone, className }) => (
  <div className={`sw-tile ${className ?? ''}`}>
    <span className="k">{label}</span>
    <span className={`v ${tone ?? ''}`}>{value}</span>
    <span className="n">{note}</span>
  </div>
);

// Sweets today: the counter's numbers, pre-bookings due, what to make and the season so far.
const SeasonalDashboard: React.FC<Props> = ({ onNavigate }) => {
  const now = useMemo(() => new Date(), []);
  const today = todayIST();
  const { data: orders = [] } = useSeasonalOrders(now.getFullYear());
  const { data: preorders = [] } = useSeasonalPreorders(now.getFullYear());
  const { data: occasions = [] } = useSeasonalOccasions();
  const { data: items = [] } = useSeasonalItems();
  const [changing, setChanging] = useState(false);

  const day = shopDay(now);
  const counter = useMemo(() => summarize(orders, preorders, dayStart(day, OPEN_HOUR), now.toISOString()), [orders, preorders, day, now]);
  const yesterday = useMemo(() => summarize(orders, preorders, dayStart(addDays(day, -1), OPEN_HOUR), dayStart(day, OPEN_HOUR)), [orders, preorders, day]);
  const unpaid = useMemo(() => unpaidOf(orders, preorders), [orders, preorders]);
  const booked = useMemo(() => bookedOf(preorders), [preorders]);
  const due = useMemo(() => dueList(preorders).slice(0, DUE_ROWS), [preorders]);
  const plan = useMemo(() => makePlan(preorders, today), [preorders, today]);
  const banner = seasonBanner(occasions, today);
  const season = occasionOn(occasions, today);
  const soFar = useMemo(() => (season ? seasonSoFar(season, orders, preorders) : undefined), [season, orders, preorders]);

  const unpaidNote = !unpaid.first ? 'Nothing to collect'
    : unpaid.count === 1 ? `${unpaid.first.name}${unpaid.first.billNo ? ` · bill #${unpaid.first.billNo}` : ''}`
    : `${plural(unpaid.count, 'bill')} · oldest ${unpaid.first.name}`;
  const openPos = () => onNavigate('seasonal_billing', posLink.bill());
  const newPreorder = () => onNavigate('seasonal_billing', posLink.preorder());

  return (
    <div className="sw-page has-cta">
      <div className="sw-head">
        <div>
          <h1>Sweets today</h1>
          <span className="sw-sub sw-desk">{clock(now, true)} · counter, pre-bookings and what to make</span>
          <span className="sw-sub sw-phone">{clock(now, false)} · {banner.short} · <button type="button" className="sw-link" onClick={() => setChanging(true)}>Change</button></span>
        </div>
        <div className="sw-actions sw-desk">
          <button type="button" className="ui-btn" onClick={newPreorder}>+ Pre-booking</button>
          <button type="button" className="ui-btn primary" onClick={openPos}>Open the counter (POS)</button>
        </div>
      </div>

      <section className="sw-banner sw-desk" aria-label="Season">
        {banner.badge && <span className="sw-badge" aria-hidden="true">{banner.badge}</span>}
        <span className="sw-banner-text"><b>{banner.title}</b><span>{banner.text}</span></span>
        <button type="button" className="sw-link" onClick={() => setChanging(true)}>Change season</button>
      </section>

      <div className="sw-tiles">
        <Tile label="Sold today" value={inr(counter.sales_total)} note={`Yesterday: ${plural(yesterday.bills_count, 'bill')} · ${inr(yesterday.sales_total)}`} />
        <Tile className="sw-desk" label="Cash · UPI today" value={`${inr(counter.cash)} · ${inr(counter.upi_total)}`} note="Close the day to match the drawer" />
        <Tile label="Unpaid bills" value={inr(unpaid.total)} note={unpaidNote} tone={unpaid.total > 0 ? 'bad' : undefined} />
        <Tile label="Pre-booked" value={inr(booked.total)} note={`${plural(booked.count, 'order')} · ${inr(booked.advance)} advance taken`} tone="warm" />
        <Tile className="sw-phone" label="Advance taken" value={inr(booked.advance)} note="" />
      </div>

      <div className="sw-two">
        <DueList list={due} today={today} onAll={() => onNavigate('seasonal_billing', posLink.preorders())} />
        <MakeList plan={plan} />
      </div>

      <SeasonSoFar season={season} data={soFar} onOccasions={() => onNavigate('seasonal_occasions')} onReports={id => onNavigate('seasonal_billing', posLink.report(id))} />

      <div className="sw-cta">
        <button type="button" className="ui-btn" onClick={newPreorder}>+ Pre-booking</button>
        <button type="button" className="ui-btn primary" onClick={openPos}>Open the counter</button>
      </div>
      {changing && <ChangeSeasonModal occasions={occasions} sweets={o => items.filter(i => i.occasion_id === o.id).length} onClose={() => setChanging(false)} />}
    </div>
  );
};

export default SeasonalDashboard;
