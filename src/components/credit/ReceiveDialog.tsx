import React, { useState } from 'react';
import UpiPanel from '../pos/UpiPanel';
import { Account } from '../../lib/credit/accounts';
import { allocate } from '../../lib/credit/allocate';
import { shortDay } from '../../lib/credit/dates';
import { PayMode } from '../../lib/payments';
import { inr } from '../../lib/money';
import { Dlg, Field, Pick, amountOf } from './Fields';
import { ReceiveInput } from './useCreditActions';

interface Props { a: Account; today: string; owner: boolean; onClose: () => void; onReceive: (r: ReceiveInput) => Promise<unknown> }

const MODE_KEY = 'shivshakti.creditMode';
const lastMode = (): PayMode => { try { return localStorage.getItem(MODE_KEY) === 'upi' ? 'upi' : 'cash'; } catch { return 'cash'; } };

// Take money for a customer: it pays the oldest bill first; more than owed is kept as advance.
const ReceiveDialog: React.FC<Props> = ({ a, today, owner, onClose, onReceive }) => {
  const [text, setText] = useState(String(a.owed));
  const [mode, setMode] = useState<PayMode>(lastMode);
  const [day, setDay] = useState(today);
  const [note, setNote] = useState('');
  const [letGo, setLetGo] = useState(false);
  const [qr, setQr] = useState(false);
  const [busy, setBusy] = useState(false);
  const amount = amountOf(text);
  const { links, left } = allocate(a.open, amount);
  const after = Math.max(0, Math.round((a.owed - amount) * 100) / 100);

  const save = async () => {
    setBusy(true);
    try { localStorage.setItem(MODE_KEY, mode); } catch { /* storage blocked */ }
    const at = day === today ? new Date().toISOString() : `${day}T12:00:00+05:30`;
    await onReceive({ amount, mode, at, note: note.trim() || undefined, letGo: letGo && after > 0 });
    setBusy(false);
    onClose();
  };

  return (
    <Dlg title={`Receive from ${a.name}`} onClose={onClose} busy={busy} disabled={amount <= 0 || day > today}
      primary={amount > 0 ? `Receive ${inr(amount)} by ${mode === 'upi' ? 'UPI' : 'cash'}` : 'Type the amount'} onSave={save}
      left={mode === 'upi' && amount > 0 && !qr ? <button type="button" className="ui-btn quiet" onClick={() => setQr(true)}>Show UPI QR</button> : undefined}>
      <span className="note">Owes {inr(a.owed)} on {a.open.length} {a.open.length === 1 ? 'bill' : 'bills'} · oldest {shortDay(a.open[0]?.day ?? today, today)}</span>
      <div className="grid2">
        <Field label="Amount received (₹)"><input inputMode="decimal" value={text} autoFocus onFocus={e => e.target.select()} onChange={e => setText(e.target.value)} /></Field>
        <Pick label="Paid by" value={mode} options={[['cash', 'Cash'], ['upi', 'UPI']]} onChange={setMode} />
      </div>
      <span className="cr-pick">
        {a.open.length > 1 && <button type="button" onClick={() => setText(String(a.open[0].due))}>{inr(a.open[0].due)} · oldest bill</button>}
        <button type="button" onClick={() => setText(String(a.owed))}>{inr(a.owed)} · everything</button>
      </span>
      {qr && mode === 'upi' && amount > 0 && <UpiPanel amount={amount} note={`Credit ${a.name}`} />}
      {links.length > 0 && (
        <div>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#5A5A55' }}>GOES TO THE OLDEST BILL FIRST</span>
          <div className="alloc">
            {a.open.map(i => {
              const l = links.find(x => x.id === i.id);
              return <div key={i.type + i.id}><span><b>{i.label}</b> · {shortDay(i.day, today)} · {inr(i.due)} due</span>
                <b className={l?.amount === i.due ? 'cr-green' : undefined}>{l ? (l.amount === i.due ? `${inr(l.amount)} · cleared` : `${inr(l.amount)} · ${inr(i.due - l.amount)} left`) : '—'}</b></div>;
            })}
          </div>
        </div>
      )}
      <div className="sum">
        <div><span>Received now</span><b>{inr(amount)}</b></div>
        {left > 0 ? <div className="cr-green"><span>More than owed: kept as advance</span><b>{inr(left)}</b></div>
          : <div className={after > 0 ? 'cr-red' : 'cr-green'}><span>Still owes after this</span><b>{inr(after)}</b></div>}
      </div>
      <details>
        <summary>More options</summary>
        <div className="cr-dlg">
          <div className="grid2">
            <Field label="Received on"><input type="date" value={day} max={today} onChange={e => setDay(e.target.value || today)} /></Field>
            <Field label="UPI ref / note"><input value={note} placeholder="e.g. 4512 9087" onChange={e => setNote(e.target.value)} /></Field>
          </div>
          {owner && after > 0 && amount > 0 && (
            <label className="check"><input type="checkbox" checked={letGo} onChange={e => setLetGo(e.target.checked)} />Let go of the remaining {inr(after)} (discount)</label>
          )}
        </div>
      </details>
    </Dlg>
  );
};

export default ReceiveDialog;
