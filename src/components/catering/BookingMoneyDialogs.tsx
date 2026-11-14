import React, { useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import { useSavePayment } from '../../hooks/useBookingPayments';
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
import PaymentFields, { blankPay, PAY_MODES, PayDraft, PayModeName, ReceiptCheck } from './PaymentFields';
import ReceiptDialog from './ReceiptDialog';

const who = (v: BookingView) => `${(v.b.customer?.name ?? 'Customer').trim()}'s ${v.b.event_type}`;
const when = (v: BookingView) => [formatDateIST(v.start, 'EEE d MMM'), v.b.guest_count ? `${v.b.guest_count} guests` : '', v.quote?.quotation_number, v.valueText].filter(Boolean).join(' · ');

interface ConfirmProps { view: BookingView; onClose: () => void; onConfirmed: (b: Booking) => void }

// Every way to Confirmed asks for the advance (token), suggested from the payment plan.
export const ConfirmBookingDialog: React.FC<ConfirmProps> = ({ view: v, onClose, onConfirmed }) => {
  const plan = useDocSettings().schedule;
  const save = useSavePayment();
  const update = useUpdateBooking();
  const m = v.money;
  const picks = m.received > 0 ? [] : confirmPicks(m.total, plan);
  const [draft, setDraft] = useState<PayDraft>(() => blankPay(picks[0]?.value ?? 0));
  const [receipt, setReceipt] = useState(true);
  const [sent, setSent] = useState<ReceiptInfo | null>(null);
  const busy = save.isPending || update.isPending;
  const amount = amountOf(draft.amount);
  const phone = v.b.customer?.phone ?? '';
  const sending = receipt && amount > 0 && phone.replace(/\D/g, '').length >= 10;
  const hint = m.range ? `Worked out on ${inr(m.total)}, the lower option, until one is picked.` : 'From your payment plan (Settings › Money).';

  const go = async (money: number) => {
    const day = draft.payment_date || todayIST();
    try {
      if (money > 0) await save.mutateAsync({ bookingId: v.b.id, invoiceId: v.invoice?.id, amount: money, payment_type: payTypeOn(v.b.event_date, day), payment_mode: draft.payment_mode, notes: draft.notes, payment_date: day });
      const saved: Booking = await update.mutateAsync({ id: v.b.id, status: 'confirmed' });
      onConfirmed(saved ?? { ...v.b, status: 'confirmed' });
      if (money > 0) toast.success(`Confirmed · ${inr(money)} received`);
      if (money > 0 && sending) setSent({ name: v.b.customer?.name ?? '', amount: money, mode: draft.payment_mode, day, advance: v.b.event_date > day, event: v.b.event_type, eventDate: v.b.event_date, total: m.total, received: m.received + money, shop: SHOP.name });
      else onClose();
    } catch (e) { toast.error(errorText(e, 'Could not confirm the booking')); }
  };

  if (sent) return <ReceiptDialog phone={phone} info={sent} onClose={onClose} />;
  return (
    <Modal title={`Confirm ${who(v)}`} onClose={onClose} width={480} busy={busy} dirty={amount !== (picks[0]?.value ?? 0)}
      footer={<>
        <button type="button" className="mx-link" style={{ marginRight: 'auto' }} onClick={() => go(0)} disabled={busy}>Confirm without advance</button>
        <button type="button" className="ui-btn" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className="ui-btn primary" onClick={() => go(amount)} disabled={busy}>
          {busy ? 'Saving…' : amount > 0 ? `Confirm · ${inr(amount)} received` : 'Confirm'}
        </button>
      </>}>
      <div className="mx-dlg">
        <p className="mx-dlg-sub">{when(v)}</p>
        {m.received > 0 && <div className="mx-banner info" role="status">{inr(m.received)} already received on this booking. Add more only if they paid again.</div>}
        <span className="mx-heading">Advance (token) received now</span>
        <PaymentFields value={draft} onChange={setDraft} picks={picks} picksHint={hint} label="Amount" upiNote={`Advance ${v.b.customer?.name ?? ''}`} />
        {m.total <= 0 && <p className="mx-hint">No quote yet, so type what they paid. Leave it empty to confirm without an advance.</p>}
        <ReceiptCheck phone={phone} on={receipt} onChange={setReceipt} />
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

interface CancelProps { view: BookingView; onClose: () => void; onDone: () => void }

// Cancelling an event that has money in: give it back (a refund) or keep it (stays income).
export const CancelBookingDialog: React.FC<CancelProps> = ({ view: v, onClose, onDone }) => {
  const save = useSavePayment();
  const update = useUpdateBooking();
  const got = v.money.received;
  const [back, setBack] = useState(true);
  const [mode, setMode] = useState<PayModeName>(() => usualMode(v));
  const busy = save.isPending || update.isPending;
  const go = async () => {
    try {
      if (back && got > 0) await save.mutateAsync({ bookingId: v.b.id, invoiceId: v.invoice?.id, amount: -got, payment_type: 'refund', payment_mode: mode, notes: 'Given back on cancel' });
      await update.mutateAsync({ id: v.b.id, status: 'cancelled' });
      toast.success(back ? `Cancelled · ${inr(got)} given back` : `Cancelled · ${inr(got)} kept`);
      onDone();
    } catch (e) { toast.error(errorText(e, 'Could not cancel the booking')); }
  };
  const cards: [boolean, string, string][] = [[true, 'Give it back', 'Records a refund, so it leaves your totals'], [false, 'Keep it', 'Stays as income (cancellation charge)']];
  return (
    <Modal title={`Cancel ${who(v)}?`} onClose={onClose} width={480} busy={busy}
      footer={<>
        <button type="button" className="ui-btn" onClick={onClose} disabled={busy}>Keep booking</button>
        <button type="button" className="ui-btn danger" onClick={go} disabled={busy}>{busy ? 'Saving…' : back ? `Cancel and give back ${inr(got)}` : `Cancel and keep ${inr(got)}`}</button>
      </>}>
      <div className="mx-dlg">
        <p className="mx-dlg-sub">{formatDateIST(v.start, 'EEE d MMM')} · {inr(got)} received</p>
        <div role="radiogroup" aria-label={`The ${inr(got)} received`} className="mx-cards">
          {cards.map(([id, title, line]) => (
            <button key={title} type="button" role="radio" aria-checked={back === id} className="mx-rcard" onClick={() => setBack(id)}>
              <i aria-hidden="true" /><span><b>{title}</b><small>{line}</small></span><b>{id ? inr(got) : ''}</b>
            </button>
          ))}
        </div>
        {back && <Picks label="Given back by" options={PAY_MODES} value={mode} onPick={setMode} />}
        <p className="mx-hint">It moves to Lost or cancelled. You can change it back from ⋯ → Change status.</p>
      </div>
    </Modal>
  );
};
