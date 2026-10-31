import React from 'react';
import { Debt, AGE_LABELS, ageBuckets, comingIn, rangeText, sumOf } from '../../lib/moneyView';
import { inr } from '../../lib/money';
import { CardHead, Chip, Empty } from './MoneyUi';

const KIND_CHIP = { invoice: { text: 'Catering', bg: '#FFF1E3', fg: '#8A4B00' }, bill: { text: 'Sweets', bg: '#E6F1FB', fg: '#185FA5' }, preorder: { text: 'Sweets', bg: '#E6F1FB', fg: '#185FA5' } };
const AGE_COLOR = ['var(--ink)', '#B26B00', '#A32D2D', '#A32D2D'];

// "To collect": age buckets, then each person with Remind and Record payment.
export const CollectCard: React.FC<{ debts: Debt[]; onRemind: (d: Debt) => void; onRecord: (d: Debt) => void }> = ({ debts, onRemind, onRecord }) => {
  const total = sumOf(debts, d => d.amount);
  const ages = ageBuckets(debts);
  const hot = ages.indexOf(Math.max(...ages));
  return (
    <section aria-label="To collect" className="mx-card wide">
      <CardHead title={<>To collect · {inr(total)}</>} right="Oldest first" />
      {!debts.length ? <Empty title="Nothing to collect" text="All money is in." /> : (
        <>
          <div className="mn-ages mn-desk-only">
            {AGE_LABELS.map((label, i) => (
              <div key={label} className={i === hot && ages[i] > 0 ? 'hot' : undefined}>
                <span>{label}</span><b style={{ color: ages[i] > 0 ? AGE_COLOR[i] : 'var(--ink)' }}>{inr(ages[i])}</b>
              </div>
            ))}
          </div>
          {debts.map(d => (
            <div key={d.key} className="mx-row mn-debt">
              <span className="mx-two-line">
                <b>{d.name} <Chip bg={KIND_CHIP[d.kind].bg} fg={KIND_CHIP[d.kind].fg}>{KIND_CHIP[d.kind].text}</Chip></b>
                <span>{d.line}</span>
              </span>
              <span className="amt">{inr(d.amount)}</span>
              <span className="mx-acts">
                <button type="button" className="ui-btn" onClick={() => onRemind(d)}>WhatsApp<span className="mx-long"> reminder</span></button>
                <button type="button" className="ui-btn mx-accent" onClick={() => onRecord(d)}>Record payment</button>
              </span>
            </div>
          ))}
        </>
      )}
    </section>
  );
};

type Coming = ReturnType<typeof comingIn>;

// "Coming in": booked but not invoiced, quotes waiting for a reply, drafts not sent.
export const ComingIn: React.FC<{ c: Coming; links?: React.ReactNode }> = ({ c, links }) => {
  const rows = [
    { label: 'Booked, not invoiced', count: `${c.booked.count} event${c.booked.count === 1 ? '' : 's'}`, value: c.booked.value, text: inr(c.booked.value), color: '#2F5A0E' },
    { label: 'Quote sent, waiting', count: String(c.sent.count), value: c.sent.high, text: rangeText(c.sent.low, c.sent.high), color: '#4A41A8' },
    { label: 'Drafts not sent yet', count: `${c.drafts.count} quote${c.drafts.count === 1 ? '' : 's'}`, value: c.drafts.value, text: inr(c.drafts.value), color: '#B8B3EE' },
  ];
  const max = Math.max(1, ...rows.map(r => r.value));
  return (
    <section aria-label="Coming in" className="mx-card pad side">
      <div className="mx-card-head"><h2>Coming in</h2>{links}</div>
      {rows.map(r => (
        <div key={r.label} className="mn-pipe">
          <span><span>{r.label} <span className="mx-sub">· {r.count}</span></span><b>{r.text}</b></span>
          <span className="mn-track"><i style={{ width: `${r.value > 0 ? Math.max(2, Math.round((r.value / max) * 100)) : 0}%`, background: r.color }} /></span>
        </div>
      ))}
      <span className="mx-sub mn-desk-only">Booked = confirmed events not invoiced yet. Quotes count only upcoming events.</span>
    </section>
  );
};
