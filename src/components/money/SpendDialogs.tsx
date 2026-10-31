import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import { Booking } from '../../types';
import { SPEND_KINDS, SCOPES, SPEND_MODES, SpendScope, SpendMode, SpendDraft, parsePasted } from '../../lib/spends';
import { addDays } from '../../lib/reports/model';
import { amountOf } from '../../lib/invoiceEdit';
import { formatDateIST, todayIST } from '../../lib/ist';
import { inr } from '../../lib/money';
import { DialogFoot, Picks } from './MoneyUi';
import { grouped } from '../catering/PaymentFields';
import { useAddSpends } from './useMoneyData';

const KINDS = SPEND_KINDS.map(k => [k, k] as [string, string]);
const eventName = (b: Booking) => `${b.customer?.name ?? 'Customer'} · ${b.event_type} ${formatDateIST(b.event_date, 'd MMM')}`;

// Events a spend can belong to: recent and coming ones, newest first.
const useEventList = (bookings: Booking[]) => useMemo(() => {
  const today = todayIST();
  return bookings.filter(b => b.status !== 'cancelled' && b.event_date <= addDays(today, 30) && b.event_date >= addDays(today, -365))
    .sort((a, b) => b.event_date.localeCompare(a.event_date));
}, [bookings]);

// "For": an event (with the event picker), the sweets counter or the shop.
const ForFields: React.FC<{ scope: SpendScope; onScope: (s: SpendScope) => void; eventId: string; onEvent: (id: string) => void; events: Booking[] }> = ({ scope, onScope, eventId, onEvent, events }) => (
  <>
    <Picks label="For" options={SCOPES} value={scope} onPick={onScope} />
    {scope === 'event' && (
      <label className="mx-field">Event
        <select value={eventId} onChange={e => onEvent(e.target.value)}>
          {!events.length && <option value="">No events yet</option>}
          {events.map(b => <option key={b.id} value={b.id}>{eventName(b)}</option>)}
        </select>
      </label>
    )}
  </>
);

const firstPast = (events: Booking[]) => (events.find(b => b.event_date <= todayIST()) ?? events[0])?.id ?? '';
const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Could not save');

// DlgExtras "Add a spend".
export const SpendModal: React.FC<{ bookings: Booking[]; onClose: () => void }> = ({ bookings, onClose }) => {
  const add = useAddSpends();
  const events = useEventList(bookings);
  const [amount, setAmount] = useState('');
  const [kind, setKind] = useState<string>('Groceries');
  const [scope, setScope] = useState<SpendScope>('event');
  const [eventId, setEventId] = useState(() => firstPast(events));
  const [mode, setMode] = useState<SpendMode>('cash');
  const [day, setDay] = useState(todayIST());
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const value = amountOf(amount);
  const error = !(value > 0) ? 'Enter how much was spent' : '';
  const save = async () => {
    setTried(true);
    if (error) return;
    const row: SpendDraft = { amount: value, kind, scope, booking_id: scope === 'event' ? eventId || null : null, mode, spent_on: day, note: note.trim() || null };
    try { await add.mutateAsync([row]); toast.success(`${inr(value)} for ${kind.toLowerCase()} added`); onClose(); }
    catch (e) { toast.error(errorText(e)); }
  };
  return (
    <Modal title="Add a spend" onClose={onClose} width={420} dirty={!!amount || !!note} busy={add.isPending}
      footer={<DialogFoot onCancel={onClose} onOk={save} ok="Add spend" busy={add.isPending} />}>
      <div className="mx-dlg">
        <p className="mx-dlg-sub">Shows as money out, and as profit per event.</p>
        <label className={`mx-field${tried && error ? ' bad' : ''}`}>Amount
          <input className="big" inputMode="decimal" autoFocus placeholder="₹" value={amount ? `₹${grouped(amount)}` : ''} onChange={e => setAmount(e.target.value.replace(/[^\d.]/g, ''))} />
          {tried && error && <span className="mx-err">{error}</span>}
        </label>
        <Picks label="What for" options={KINDS} value={kind} onPick={setKind} />
        <ForFields scope={scope} onScope={setScope} eventId={eventId} onEvent={setEventId} events={events} />
        <Picks label="Paid by" options={SPEND_MODES} value={mode} onPick={setMode} />
        <div className="mx-grid2">
          <label className="mx-field">Date<input type="date" value={day} max={todayIST()} onChange={e => setDay(e.target.value)} /></label>
          <label className="mx-field">Note<input value={note} placeholder="Optional" onChange={e => setNote(e.target.value)} /></label>
        </div>
      </div>
    </Modal>
  );
};

// DlgExtras "Paste spends": rows from Excel or WhatsApp with a preview of what will be added.
export const SpendPaste: React.FC<{ bookings: Booking[]; onClose: () => void }> = ({ bookings, onClose }) => {
  const add = useAddSpends();
  const events = useEventList(bookings);
  const [text, setText] = useState('');
  const [scope, setScope] = useState<SpendScope>('event');
  const [eventId, setEventId] = useState(() => firstPast(events));
  const rows = useMemo(() => parsePasted(text, todayIST()), [text]);
  const good = rows.filter(r => r.ok);
  const tag = scope === 'event' ? (events.find(b => b.id === eventId) ? eventName(events.find(b => b.id === eventId)!) : 'An event') : SCOPES.find(s => s[0] === scope)![1];
  const save = async () => {
    try {
      await add.mutateAsync(good.map(r => ({ amount: r.amount, kind: r.kind, scope, booking_id: scope === 'event' ? eventId || null : null, mode: 'cash', spent_on: r.day!, note: r.what || null })));
      toast.success(`${good.length} spend${good.length === 1 ? '' : 's'} added`);
      onClose();
    } catch (e) { toast.error(errorText(e)); }
  };
  return (
    <Modal title="Paste spends" onClose={onClose} width={560} dirty={!!text} busy={add.isPending}
      footer={<DialogFoot onCancel={onClose} onOk={save} ok={`Add ${good.length} spend${good.length === 1 ? '' : 's'}`} busy={add.isPending} disabled={!good.length} />}>
      <div className="mx-dlg">
        <p className="mx-dlg-sub">Copy rows from Excel or WhatsApp: date, amount, what for.</p>
        <label className="mx-field">Rows
          <textarea autoFocus value={text} placeholder={'13 Sep\t4,200\tGroceries\n14 Sep\t800\tTransport'} onChange={e => setText(e.target.value)} />
        </label>
        <ForFields scope={scope} onScope={setScope} eventId={eventId} onEvent={setEventId} events={events} />
        {rows.length > 0 && (
          <div className="mx-field">
            <span className="mx-heading">What will happen</span>
            <div className="mx-list">
              {rows.map((r, i) => (
                <div key={i}>
                  <span className="mx-two-line">
                    <b style={{ fontSize: 14 }}>{r.ok ? `${formatDateIST(r.day!, 'd MMM')} · ${r.kind}` : 'Not understood, left out'}</b>
                    <span className={r.ok ? undefined : 'mx-red'}>{r.ok ? tag : r.line}</span>
                  </span>
                  <b>{r.ok ? inr(r.amount) : ''}</b>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
