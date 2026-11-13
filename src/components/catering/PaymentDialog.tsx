import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import { useConfirm } from '../ui/ConfirmDialog';
import { usePaymentRows, useSavePayment, useRemovePayment } from '../../hooks/useBookingPayments';
import { useDocSettings } from '../../hooks/useDocSettings';
import { Booking, Invoice, Payment } from '../../types';
import { formatDateIST, todayIST } from '../../lib/ist';
import { inr } from '../../lib/money';
import { amountOf } from '../../lib/invoiceEdit';
import { basisOf, moneyOf, paymentPicks, paymentsFor, payTypeOn } from '../../lib/bookingMoney';
import { ReceiptInfo } from '../../lib/bookingReceipt';
import { SHOP } from '../../lib/shop';
import { errorText } from '../../lib/errors';
import PaymentFields, { blankPay, modeLabel, PayDraft, ReceiptCheck } from './PaymentFields';
import ReceiptDialog from './ReceiptDialog';

export type PayBooking = Pick<Booking, 'id' | 'event_type' | 'event_date'> & { customer?: Booking['customer'] };
type QuoteTotal = { total_amount: number; total_max?: number | null; status?: string };
interface Props { booking: PayBooking; invoice?: Invoice; quote?: QuoteTotal; payment?: Payment; onClose: () => void }

// An invoice's booking, for screens that only hold the invoice.
export const bookingOfInvoice = (inv: Invoice): PayBooking => inv.booking ?? { id: inv.booking_id, event_type: 'Event', event_date: inv.issue_date };

const failText = (e: unknown) => errorText(e, 'Could not save the payment');

// Money on a booking, before or after its invoice: add one payment or change one (DlgMoney "Payment from …").
const PaymentDialog: React.FC<Props> = ({ booking: b, invoice, quote, payment, onClose }) => {
  const { data: rows = [] } = usePaymentRows();
  const plan = useDocSettings().schedule;
  const save = useSavePayment();
  const remove = useRemovePayment();
  const { confirm, dialog } = useConfirm();
  const others = useMemo(() => paymentsFor(rows, b.id).filter(p => p.id !== payment?.id), [rows, b.id, payment?.id]);
  const m = moneyOf(basisOf(invoice, quote), others);
  const picks = payment ? [] : paymentPicks(m.total, plan, m.received);
  const [draft, setDraft] = useState<PayDraft>(() => payment
    ? { amount: String(payment.amount), payment_mode: payment.payment_mode, notes: payment.notes ?? '', payment_date: payment.payment_date }
    : blankPay(picks[0]?.value ?? 0));
  const phone = b.customer?.phone ?? '';
  const [receipt, setReceipt] = useState(!payment);
  const [sent, setSent] = useState<ReceiptInfo | null>(null);
  const [tried, setTried] = useState(false);
  const busy = save.isPending || remove.isPending;
  const amount = amountOf(draft.amount);
  const error = !(amount > 0) ? 'Enter the amount received' : '';
  const name = (b.customer?.name ?? 'customer').trim();
  const extra = m.total > 0 && amount > m.due ? amount - m.due : 0;
  const after = m.received + amount;
  const sending = receipt && !payment && phone.replace(/\D/g, '').length >= 10;

  const submit = async () => {
    setTried(true);
    if (error) return;
    const day = draft.payment_date || todayIST();
    try {
      await save.mutateAsync({
        id: payment?.id, bookingId: b.id, invoiceId: invoice?.id ?? payment?.invoice_id, amount, notes: draft.notes, payment_date: day,
        payment_type: payment?.payment_type ?? payTypeOn(b.event_date, day), payment_mode: draft.payment_mode,
      });
      toast.success(m.total > 0 && after < m.total ? `${inr(amount)} saved · ${inr(m.total - after)} still due` : `${inr(amount)} saved`);
      if (sending) setSent({ name, amount, mode: draft.payment_mode, day, advance: b.event_date > day, event: b.event_type, eventDate: b.event_date, total: m.total, received: after, shop: SHOP.name });
      else onClose();
    } catch (e) { toast.error(failText(e)); }
  };

  const del = async () => {
    if (!payment) return;
    const ok = await confirm({ title: `Remove the ${inr(payment.amount)} payment?`, message: `${modeLabel(payment.payment_mode)} · ${formatDateIST(payment.payment_date, 'EEE d MMM')}. Only for a mistake: money given back on a cancelled event is recorded when you cancel it.`, confirmLabel: `Remove ${inr(payment.amount)}`, danger: true });
    if (!ok) return;
    try { await remove.mutateAsync({ id: payment.id, invoiceId: payment.invoice_id }); toast.success('Payment removed'); onClose(); }
    catch (e) { toast.error(failText(e)); }
  };

  if (sent) return <ReceiptDialog phone={phone} info={sent} onClose={onClose} />;
  const dirty = payment ? amount !== payment.amount || draft.payment_mode !== payment.payment_mode || draft.notes !== (payment.notes ?? '') || draft.payment_date !== payment.payment_date : !!draft.notes || amount !== (picks[0]?.value ?? 0);
  return (
    <Modal title={payment ? 'Edit payment' : `Payment from ${name}`} onClose={onClose} width={460} dirty={dirty} busy={busy}
      footer={<>
        {payment && <button type="button" className="mx-link" style={{ color: '#A32D2D', marginRight: 'auto' }} onClick={del} disabled={busy}>Remove payment</button>}
        <button type="button" className="ui-btn" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className="ui-btn primary" onClick={submit} disabled={busy || (tried && !!error)}>
          {busy ? 'Saving…' : payment ? 'Save changes' : sending ? 'Save and send receipt' : `Save ${amount > 0 ? inr(amount) : ''}`.trim()}
        </button>
      </>}>
      <div className="mx-dlg">
        <p className="mx-dlg-sub">{[b.event_type, formatDateIST(b.event_date, 'EEE d MMM'), invoice?.invoice_number ?? (payment?.invoice_id ? '' : 'no invoice yet')].filter(Boolean).join(' · ')}</p>
        {extra > 0 && <div className="mx-banner warn" role="status">{inr(extra)} more than the balance due. It is kept as extra paid and shows on the invoice.</div>}
        {(m.total > 0 || m.received !== 0) && (
          <div className="mx-sum">
            {m.total > 0 && <span><span>{m.label}{m.range ? ' (lower option)' : ''}</span><span>{inr(m.total)}</span></span>}
            <span className="good"><span>Received{payment ? ' (other payments)' : ''}</span><span>{inr(m.received)}{m.count ? ` · ${m.count} payment${m.count === 1 ? '' : 's'}` : ''}</span></span>
            {m.total > 0 && <span className="strong"><span>Balance due</span><span>{inr(m.due)}</span></span>}
          </div>
        )}
        <PaymentFields value={draft} onChange={setDraft} picks={picks} error={tried ? error : ''} open={!!payment} />
        {!payment && <ReceiptCheck phone={phone} on={receipt} onChange={setReceipt} />}
        {!invoice && !payment?.invoice_id && <p className="mx-hint">Saved on this booking. It will appear on the invoice with its own date.</p>}
      </div>
      {dialog}
    </Modal>
  );
};

export default PaymentDialog;
