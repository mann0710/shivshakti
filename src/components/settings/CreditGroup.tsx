import React from 'react';
import { CreditSettings } from '../../lib/credit/types';
import { inr } from '../../lib/money';
import { Panel, Row, Switch } from './SettingsUi';
import { SettingsApi } from './useSettingsSave';

type NumKey = 'limit' | 'block_days' | 'pay_days' | 'remind_every';
const CHOICES: Record<NumKey, number[]> = {
  limit: [0, 1000, 2000, 3000, 5000, 10000, 25000],
  block_days: [0, 30, 45, 60, 90],
  pay_days: [3, 7, 15, 30],
  remind_every: [2, 3, 5, 7, 15],
};
const text: Record<NumKey, (n: number) => string> = {
  limit: n => (n ? inr(n) : 'No limit'),
  block_days: n => (n ? `${n} days` : 'Off'),
  pay_days: n => (n === 7 ? '1 week' : n === 30 ? '1 month' : `${n} days`),
  remind_every: n => `${n} days`,
};

// Settings › Credit: whether the counter gives credit, the default limit and the follow-up rhythm.
const CreditGroup: React.FC<{ api: SettingsApi }> = ({ api }) => {
  const { docs, docsReady, saveDoc } = api;
  const c = docs.credit;
  const set = (label: string, patch: Partial<CreditSettings>) => saveDoc(`Credit: ${label}`, 'credit', { ...c, ...patch });
  const pick = (key: NumKey, label: string) => (
    <select className="st-select" aria-label={label} value={c[key]} disabled={!docsReady || !c.on} onChange={e => set(label, { [key]: Number(e.target.value) })}>
      {Array.from(new Set([...CHOICES[key], c[key]])).sort((a, b) => a - b).map(n => <option key={n} value={n}>{text[key](n)}</option>)}
    </select>
  );

  return (
    <Panel id="credit" title="Credit (pay later)" sub="Sweets given now and paid for later.">
      <div className="st-rows">
        <Row label="Credit at the counter" note="Off hides Credit as a way to pay.">
          <Switch label="Credit at the counter" on={c.on} disabled={!docsReady} onChange={on => set('Credit at the counter', { on })} />
        </Row>
        <Row label="Credit limit per customer" note="Shop default; each customer can have their own in Credit › ⋯ › Credit settings.">{pick('limit', 'Credit limit per customer')}</Row>
        <Row label="Over the limit" note="Warn lets the counter carry on after a warning. Block needs an owner login, who types why.">
          <select className="st-select" aria-label="Over the limit" value={c.over} disabled={!docsReady || !c.on} onChange={e => set('Over the limit', { over: e.target.value as CreditSettings['over'] })}>
            <option value="warn">Warn</option><option value="block">Block (owner allows)</option>
          </select>
        </Row>
        <Row label="Stop credit when a bill is this old" note="Treated like being over the limit.">{pick('block_days', 'Stop credit when a bill is this old')}</Row>
        <Row label="Pay by (default)" note="Suggested at the counter and printed on the receipt.">{pick('pay_days', 'Pay by (default)')}</Row>
        <Row label="Remind again every" note="Brings them back to Follow up today.">{pick('remind_every', 'Remind again every')}</Row>
        <Row label="Reminder language" note="For new customers; each can be changed.">
          <select className="st-select" aria-label="Reminder language" value={c.lang} disabled={!docsReady || !c.on} onChange={e => set('Reminder language', { lang: e.target.value as CreditSettings['lang'] })}>
            <option value="en">English</option><option value="hi">हिंदी (Hindi)</option>
          </select>
        </Row>
        <Row label="Signature line on credit receipts" note="The customer signs the 80 mm receipt.">
          <Switch label="Signature line on credit receipts" on={c.signature} disabled={!docsReady || !c.on} onChange={signature => set('Signature line', { signature })} />
        </Row>
      </div>
    </Panel>
  );
};

export default CreditGroup;
