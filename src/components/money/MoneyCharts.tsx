import React, { useState } from 'react';
import { MonthBar, Receipt, MODE_NAME, receivedSummary, shortInr, fyLabel } from '../../lib/moneyView';
import { Spend, SPEND_KINDS, byKind, spentTotal } from '../../lib/spends';
import { formatDateIST } from '../../lib/ist';
import { inr } from '../../lib/money';
import { CardHead, Empty } from './MoneyUi';
import { SPENDS_MIGRATION_FILE } from './useMoneyData';

const CATERING = '#E8750A';
const SWEETS = '#3C7EA8';

// "Received each month": one financial year, catering and sweets stacked.
export const MonthBars: React.FC<{ bars: MonthBar[]; from: string }> = ({ bars, from }) => {
  const max = Math.max(1, ...bars.map(b => b.catering + b.sweets));
  const said = bars.filter(b => b.catering + b.sweets > 0).map(b => `${b.label} ${inr(b.catering + b.sweets)}`).join(', ') || 'nothing yet';
  const h = (n: number) => `${Math.round((n / max) * 140)}px`;
  return (
    <section aria-label="Received by month" className="mx-card pad wide mn-desk-only">
      <div className="mx-card-head">
        <h2>Received each month · {fyLabel(from)}</h2>
        <span className="mn-legend"><span><i style={{ background: CATERING }} />Catering</span><span><i style={{ background: SWEETS }} />Sweets</span></span>
      </div>
      <div className="mn-bars" role="img" aria-label={`Received: ${said}`}>
        {bars.map(b => (
          <div key={b.ym}>
            {b.catering + b.sweets > 0 && <small>{shortInr(b.catering + b.sweets)}</small>}
            <i className={b.sweets ? 'top' : undefined} style={{ height: h(b.sweets), background: SWEETS }} />
            <i className={!b.sweets ? 'top' : undefined} style={{ height: h(b.catering), background: CATERING }} />
          </div>
        ))}
      </div>
      <div className="mn-months">{bars.map(b => <span key={b.ym}>{b.label}</span>)}</div>
    </section>
  );
};

// "Payments received" in the period, newest first.
export const PaymentsCard: React.FC<{ list: Receipt[] }> = ({ list }) => {
  const [all, setAll] = useState(false);
  const s = receivedSummary(list);
  const shown = all ? list : list.slice(0, 8);
  return (
    <section aria-label="Payments received" className="mx-card">
      <CardHead title="Payments received" right={`Cash ${inr(s.cash)} · UPI ${inr(s.upi)} · bank ${inr(s.bank)}`} />
      {!list.length && <Empty title="Nothing in these dates" text="Try a longer range." />}
      {shown.map(r => (
        <div key={r.key} className="mx-row mn-pay">
          <span className="mx-sub">{formatDateIST(r.day, 'd MMM')}</span>
          <span>{r.who} · {r.what}</span>
          <span className="mode mx-sub">{MODE_NAME[r.mode]}</span>
          <span className={`r${r.amount < 0 ? ' mx-red' : ''}`}>{inr(r.amount)}</span>
        </div>
      ))}
      {list.length > 8 && <div className="mx-row"><button type="button" className="mx-link" onClick={() => setAll(v => !v)}>{all ? 'Show fewer' : `Show all ${list.length}`}</button></div>}
    </section>
  );
};

interface ProfitProps { spends: Spend[] | null; received: number; onAdd: () => void; onPaste: () => void }

// "See profit, not just sales": a teaser until spends are noted, then received minus spent.
export const ProfitCard: React.FC<ProfitProps> = ({ spends, received, onAdd, onPaste }) => {
  const spent = spends ? spentTotal(spends) : 0;
  const kinds = spends ? byKind(spends) : [];
  return (
    <section aria-label="Spending" className={`mx-card pad side mn-desk-only${spends?.length ? '' : ' mn-profit'}`}>
      <h2 style={{ fontSize: 16, fontWeight: 700 }}>{spends?.length ? 'Profit in these dates' : 'See profit, not just sales'}</h2>
      {spends === null ? (
        <p className="mx-banner info"><span><b>A database update is waiting.</b> Spends need it. Ask whoever looks after the app to run {SPENDS_MIGRATION_FILE}.</span></p>
      ) : spends.length ? (
        <>
          <div className="iv-sum">
            <span><span>Received</span><span>{inr(received)}</span></span>
            <span><span>Spent</span><span>− {inr(spent)}</span></span>
            <span className="big rule" style={{ color: received - spent >= 0 ? '#0F6E56' : '#A32D2D' }}><span>Left over</span><span>{inr(received - spent)}</span></span>
          </div>
          <div className="mn-kinds">{kinds.map(k => <span key={k.kind}>{k.kind} {inr(k.amount)}</span>)}</div>
        </>
      ) : (
        <>
          <p>Note what you spend — groceries, cooks and staff, gas, transport, rent — and tag it to an event or to the sweets counter. Money then shows profit per event and per month.</p>
          <div className="mn-kinds">{SPEND_KINDS.filter(k => k !== 'Other').map(k => <span key={k}>{k}</span>)}</div>
        </>
      )}
      <span className="mx-acts" style={{ justifyContent: 'flex-start', marginTop: 'auto' }}>
        <button type="button" className="ui-btn primary" onClick={onAdd} disabled={spends === null}>+ Add a spend</button>
        <button type="button" className="ui-btn" onClick={onPaste} disabled={spends === null}>Paste from Excel</button>
      </span>
    </section>
  );
};
