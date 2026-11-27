import React, { useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import { useRemovePayment, useSavePayment } from '../../hooks/useBookingPayments';
import { useUpdateBooking } from '../../hooks/useBookings';
import { useDocSettings } from '../../hooks/useDocSettings';
import { Booking } from '../../types';
import { BookingView } from '../../lib/bookingBoard';
import { confirmPicks, payTypeOn } from '../../lib/bookingMoney';
import { ReceiptInfo } from '../../lib/bookingReceipt';
import { amountOf } from '../../lib/invoiceEdit';
import { formatDateIST, todayIST } from '../../lib/ist';
import { inr } from '../../lib/money';
import { SHOP } from '../../lib/shop';
import { errorText } from '../../lib/errors';
import { Picks } from '../money/MoneyUi';
import { blankPay, PAY_MODES, PayDraft, PayModeName } from './PaymentFields';
import AdvanceChoice, { AdvanceKind } from './AdvanceChoice';
import { useConfirmBooking, missingFunction, newId } from '../../hooks/useConfirmBooking';
import { undoToast } from '../pos/undoToast';
import ReceiptDialog from './ReceiptDialog';

const who = (v: BookingView) => `${(v.b.customer?.name ?? 'Customer').trim()}'s ${v.b.event_type}`;
const when = (v: BookingView) => [formatDateIST(v.start, 'EEE d MMM'), v.b.guest_count ? `${v.b.guest_count} guests` : '', v.quote?.quotation_number, v.valueText].filter(Boolean).join(' · ');

interface ConfirmProps { view: BookingView; onClose: () => void; onConfirmed: (b: Booking) => void }

// Confirming a booking with no quote to lock: only the advance, chosen on purpose.
export const ConfirmBookingDialog: React.FC<ConfirmProps> = ({ view: v, onClose, onConfirmed }) => {
  const plan = useDocSettings().schedule;
  const save = useSavePayment();
  const update = useUpdateBooking();
  const m = v.money;
  const picks = confirmPicks(m.total, plan);
  const [draft, setDraft] = useState<PayDraft>(() => blankPay(0));
  const [kind, setKind] = useState<AdvanceKind | null>(null);
  const [receipt, setReceipt] = useState(false);
  const [sent, setSent] = useState<ReceiptInfo | null>(null);
  const [payId] = useState(newId);
  const confirmBooking = useConfirmBooking();
  const busy = save.isPending || update.isPending || confirmBooking.isPending;
  const amount = kind === 'new' ? amountOf(draft.amount) : 0;
  const phone = v.b.customer?.phone ?? '';
  const sending = receipt && amount > 0 && phone.replace(/\D/g, '').length >= 10;
  const hint = m.range ? `Worked out on ${inr(m.total)}, the lower option, until one is picked.` : 'From your payment plan (Settings › Money).';
  const ready = !!kind && (kind !== 'new' || amount > 0);

  const go = async () => {
    const day = draft.payment_date || todayIST();
    const payment = amount > 0 ? { id: payId, amount, payment_type: payTypeOn(v.b.event_date, day), payment_mode: draft.payment_mode, notes: draft.notes, payment_date: day } : null;
    try {
      let saved: Booking | null = null;
      try {
        // An invoiced booking's payment also updates the invoice, which only the step-by-step save does.
        if (v.invoice) throw Object.assign(new Error('confirm_booking skipped'), { code: 'PGRST202' });
        await confirmBooking.mutateAsync({ bookingId: v.b.id, payment, anyStatus: true });
        saved = { ...v.b, status: 'confirmed' };
      } catch (e) {
        if (!missingFunction(e)) throw e;
        if (payment) await save.mutateAsync({ bookingId: v.b.id, invoiceId: v.invoice?.id, amount, payment_type: payment.payment_type, payment_mode: draft.payment_mode, notes: draft.notes, payment_date: day, createId: payId });
        saved = await update.mutateAsync({ id: v.b.id, status: 'confirmed' });
      }
      onConfirmed(saved ?? { ...v.b, status: 'confirmed' });
      if (amount > 0) toast.success(`Confirmed · ${inr(amount)} received`);
      if (sending) setSent({ name: v.b.customer?.name ?? '', amount, mode: draft.payment_mode, day, advance: v.b.event_date > day, event: v.b.event_type, eventDate: v.b.event_date, total: m.total, received: m.received + amount, shop: SHOP.name });
      else onClose();
    } catch (e) { toast.error(errorText(e, 'Could not confirm the booking')); }
  };

  if (sent) return <ReceiptDialog phone={phone} info={sent} onClose={onClose} />;
  return (
    <Modal title={`Confirm ${who(v)}`} onClose={onClose} width={480} busy={busy} dirty={!!kind}
      footer={<>
        <button type="button" className="ui-btn" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className="ui-btn primary" onClick={go} disabled={busy || !ready}>{busy ? 'Saving…' : 'Confirm booking'}</button>
      </>}>
      <div className="mx-dlg">
        <p className="mx-dlg-sub">{when(v)}</p>
        {m.total <= 0 && <p className="mx-hint">No quote yet: the booking is confirmed on its estimate. Make a quote later to lock the menu and price.</p>}
        <AdvanceChoice had={m.received} kind={kind} onKind={setKind} draft={draft} onDraft={setDraft} picks={picks} picksHint={hint}
          phone={phone} receipt={receipt} onReceipt={setReceipt} upiNote={`Advance ${v.b.customer?.name ?? ''}`} />
        {m.total > 0 && amount > 0 && (
          <div className="mx-sum">
            <span><span>{m.label}</span><span>{inr(m.total)}</span></span>
            <span className="good"><span>Advance now</span><span>− {inr(amount)}</span></span>
            <span className="strong"><span>Balance due</span><span>{inr(Math.max(0, m.total - m.received - amount))}</span></span>
          </div>
        )}
      </div>
    </Modal>
  );
};

// The mode most of the money came in, offered for giving it back.
const usualMode = (v: BookingView): PayModeName => {
  const by = (mode: string) => v.payments.filter(p => p.payment_mode === mode).reduce((s, p) => s + Number(p.amount), 0);
  return (PAY_MODES.map(([k]) => k).sort((a, b) => by(b) - by(a))[0]) ?? 'cash';
};

interface CancelProps { view: BookingView; onClose: () => void; onDone: () => void; onNewDate?: () => void }

// Cancelling an event that has money in: give it back (a refund), keep it (stays income), or keep the booking on a new date.
export const CancelBookingDialog: React.FC<CancelProps> = ({ view: v, onClose, onDone, onNewDate }) => {
  const save = useSavePayment();
  const update = useUpdateBooking();
  const got = v.money.received;
  const remove = useRemovePayment();
  const [back, setBack] = useState(true);
  const [backText, setBackText] = useState(String(got));
  const [moving, setMoving] = useState(false);
  const [mode, setMode] = useState<PayModeName>(() => usualMode(v));
  const [refundId] = useState(newId);
  const busy = save.isPending || update.isPending;
  // Give back all of it or part; the rest stays as a cancellation charge.
  const amount = back ? Math.min(got, amountOf(backText)) : 0;
  const was = v.b.status;
  const undo = async () => {
    try {
      if (amount > 0) await remove.mutateAsync({ id: refundId, invoiceId: v.invoice?.id });
      await update.mutateAsync({ id: v.b.id, status: was });
      toast.success('Cancel undone');
    } catch (e) { toast.error(errorText(e, 'Could not undo')); }
  };
  const go = async () => {
    try {
      if (amount > 0) await save.mutateAsync({ bookingId: v.b.id, invoiceId: v.invoice?.id, amount: -amount, payment_type: 'refund', payment_mode: mode, notes: 'Given back on cancel', createId: refundId });
      await update.mutateAsync({ id: v.b.id, status: 'cancelled' });
      undoToast(amount > 0 ? `Cancelled · ${inr(amount)} given back${amount < got ? `, ${inr(got - amount)} kept` : ''}` : `Cancelled · ${inr(got)} kept`, undo);
      onDone();
    } catch (e) { toast.error(errorText(e, 'Could not cancel the booking')); }
  };
  const cards: [boolean, string, string][] = [[true, 'Give it back', 'Records a refund, so it leaves your totals'], [false, 'Keep it', 'Stays as income (cancellation charge)']];
  return (
    <Modal title={`Cancel ${who(v)}?`} onClose={onClose} width={480} busy={busy}
      footer={<>
        <button type="button" className="ui-btn" onClick={onClose} disabled={busy}>Keep booking</button>
        {moving ? <button type="button" className="ui-btn primary" onClick={() => { onClose(); onNewDate?.(); }}>Change the date</button>
          : <button type="button" className="ui-btn danger" onClick={go} disabled={busy}>{busy ? 'Saving…' : back ? `Cancel and give back ${inr(amount)}` : `Cancel and keep ${inr(got)}`}</button>}
      </>}>
      <div className="mx-dlg">
        <p className="mx-dlg-sub">{formatDateIST(v.start, 'EEE d MMM')} · {inr(got)} received</p>
        <div role="radiogroup" aria-label={`The ${inr(got)} received`} className="mx-cards">
          {cards.map(([id, title, line]) => (
            <button key={title} type="button" role="radio" aria-checked={!moving && back === id} className="mx-rcard" onClick={() => { setMoving(false); setBack(id); }}>
              <i aria-hidden="true" /><span><b>{title}</b><small>{line}</small></span><b>{id ? inr(got) : ''}</b>
            </button>
          ))}
          {onNewDate && (
            <button type="button" role="radio" aria-checked={moving} className="mx-rcard" onClick={() => setMoving(true)}>
              <i aria-hidden="true" /><span><b>Move it to a new date</b><small>The booking, quote and money stay; only the date changes</small></span><b />
            </button>
          )}
        </div>
        {back && !moving && (
          <label className="mx-field">Give back
            <input inputMode="decimal" value={backText ? `₹${backText}` : ''} placeholder="₹" aria-label="Amount to give back" onChange={e => setBackText(e.target.value.replace(/[^\d.]/g, ''))} />
            <span className="mx-hint">{amount < got ? `${inr(got - amount)} is kept as a cancellation charge` : 'All of it'}</span>
          </label>
        )}
        {back && !moving && <Picks label="Given back by" options={PAY_MODES} value={mode} onPick={setMode} />}
        <p className="mx-hint">It moves to Lost or cancelled. You can change it back from ⋯ → Change status.</p>
      </div>
    </Modal>
  );
};
