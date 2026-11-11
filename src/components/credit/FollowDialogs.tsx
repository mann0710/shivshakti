import React, { useState } from 'react';
import { Account } from '../../lib/credit/accounts';
import { addDays, shortDay } from '../../lib/credit/dates';
import { CallOutcome, OUTCOMES } from '../../lib/credit/types';
import { inr } from '../../lib/money';
import { Dlg, Field, Pick, amountOf } from './Fields';

interface Base { a: Account; today: string; onClose: () => void }

// Next Saturday, for the "by the weekend" chip.
const nextSat = (today: string) => { const d = new Date(`${today}T00:00:00Z`).getUTCDay(); return addDays(today, ((6 - d + 7) % 7) || 7); };

export const PromiseDialog: React.FC<Base & { onSave: (date: string, amount: number, note: string) => Promise<unknown> }> = ({ a, today, onClose, onSave }) => {
  const options: [string, string][] = [[addDays(today, 1), 'Tomorrow'], [nextSat(today), shortDay(nextSat(today), today)], [addDays(today, 7), 'In a week']];
  const [date, setDate] = useState(options[1][0]);
  const [text, setText] = useState(String(a.owed));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); await onSave(date, amountOf(text), note.trim()); setBusy(false); onClose(); };
  return (
    <Dlg title={`${a.name} promised to pay`} onClose={onClose} busy={busy} disabled={!date || date < today} primary="Save promise" onSave={save}>
      <span className="note">Owes {inr(a.owed)}{a.promise?.broken ? ` · missed the last promise (${shortDay(a.promise.date, today)})` : ''}</span>
      <Pick label="Pay by" value={options.some(o => o[0] === date) ? date : ''} options={options} onChange={setDate} />
      <div className="grid2">
        <Field label="Or pick a date"><input type="date" value={date} min={today} onChange={e => setDate(e.target.value)} /></Field>
        <Field label="Amount (₹)"><input inputMode="decimal" value={text} onChange={e => setText(e.target.value)} /></Field>
      </div>
      <Field label="Note"><input value={note} placeholder="e.g. after salary" onChange={e => setNote(e.target.value)} /></Field>
      <span className="note">Follow up moves to that day. If money is still due then, it shows as a missed promise.</span>
    </Dlg>
  );
};

export const CallDialog: React.FC<Base & { onSave: (o: CallOutcome, note: string) => Promise<unknown>; onPromise: () => void }> = ({ a, onClose, onSave, onPromise }) => {
  const [outcome, setOutcome] = useState<CallOutcome>('no_answer');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true); await onSave(outcome, note.trim()); setBusy(false); onClose();
    if (outcome === 'will_pay') onPromise();
  };
  return (
    <Dlg title={`Called ${a.name}`} onClose={onClose} busy={busy} primary={outcome === 'will_pay' ? 'Save and set a date' : 'Save'} onSave={save}>
      <span className="note"><a href={`tel:${a.phone}`}>Call {a.phone}</a> · owes {inr(a.owed)}</span>
      <Pick label="What happened?" value={outcome} options={OUTCOMES.map(o => [o.id, o.label])} onChange={setOutcome} />
      <Field label="Note"><textarea rows={3} value={note} onChange={e => setNote(e.target.value)} /></Field>
      <span className="note">“Says not owed” marks the account Disputed and pauses reminders until you clear it in Credit settings.</span>
    </Dlg>
  );
};
