import React from 'react';
import { Reminder, ReminderKey } from '../../lib/docs/settings';
import { Panel, Row, Switch } from './SettingsUi';
import { SettingsApi } from './useSettingsSave';

type Way = 'before' | 'after';
const ITEMS: { key: ReminderKey; label: string; note: string; way: Way }[] = [
  { key: 'pay_due', label: 'Payment due', note: 'Money still due on an invoice, from this many days before the event', way: 'before' },
  { key: 'quote_reply', label: 'Quote with no reply', note: 'A sent quotation the customer hasn’t answered', way: 'after' },
  { key: 'pickup', label: 'Pre-booking pickup', note: 'Sweets to hand over, with the balance to collect', way: 'before' },
  { key: 'sweets_unpaid', label: 'Unpaid sweets bill', note: 'A counter bill that is still not fully paid', way: 'after' },
];

const DAYS = [0, 1, 2, 3, 5, 7, 10, 14, 30];
export const reminderText = (r: Reminder, way: Way) => (!r.on ? 'Off'
  : way === 'before' ? (r.days === 0 ? 'On the day' : r.days === 1 ? 'The day before' : `${r.days} days before`)
  : r.days === 0 ? 'Straight away' : `After ${r.days} day${r.days === 1 ? '' : 's'}`);

// Settings › Reminders on Home: when each reminder shows in "Needs you", or off.
const RemindersGroup: React.FC<{ api: SettingsApi }> = ({ api }) => {
  const { docs, docsReady, saveDoc } = api;
  const set = (key: ReminderKey, patch: Partial<Reminder>) =>
    saveDoc(`Reminder: ${ITEMS.find(i => i.key === key)!.label}`, 'reminders', { ...docs.reminders, [key]: { ...docs.reminders[key], ...patch } });

  return (
    <Panel id="reminders" title="Reminders on Home" sub="One tap sends each on WhatsApp.">
      <p className="st-sub" style={{ margin: 0 }}>They show in “Needs you” on Home at the time you pick here.</p>
      <div className="st-rows st-rem">
        {ITEMS.map(i => {
          const r = docs.reminders[i.key];
          return (
            <Row key={i.key} label={i.label} note={i.note}>
              <select className="st-select" aria-label={`When to show ${i.label}`} value={r.days} disabled={!docsReady || !r.on}
                onChange={e => set(i.key, { days: Number(e.target.value) })}>
                {DAYS.map(d => <option key={d} value={d}>{reminderText({ on: true, days: d }, i.way)}</option>)}
              </select>
              <Switch label={i.label} on={r.on} disabled={!docsReady} onChange={on => set(i.key, { on })} />
            </Row>
          );
        })}
      </div>
    </Panel>
  );
};

export default RemindersGroup;
