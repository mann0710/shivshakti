import React, { useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import { useConfirm } from '../ui/ConfirmDialog';
import { useDeletePayment, useRecordPayment, useUpdatePayment } from '../../hooks/useInvoices';
import { Invoice, Payment } from '../../types';
import { formatDateIST, todayIST } from '../../lib/ist';
import { inr } from '../../lib/money';
import { afterThis, amountOf } from '../../lib/invoiceEdit';
import { openWhatsApp } from '../../lib/receipt';
import { SHOP } from '../../lib/shop';
import PaymentFields, { blankPay, modeLabel, PayDraft } from './PaymentFields';

interface Props { invoice: Invoice; onClose: () => void; payment?: Payment }

const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Could not save the payment');

// Receipt text sent after a payment is saved.
const receiptText = (inv: Invoice, amount: number, mode: string, day: string, left: number) => [
  `Namaste ${inv.booking?.customer?.name ?? ''},`,
  `Received ${inr(amount)} by ${modeLabel(mode)} on ${formatDateIST(day, 'd MMM yyyy')} for ${inv.invoice_number}.`,
  left > 0 ? `Balance still due: ${inr(left)}.` : 'Your invoice is now paid in full.',
  `Thank you! ${SHOP.name}`,
].join('\n');

// Records (or changes) one payment against an invoice; DlgMoney "Payment from …".
const PaymentFormModal: React.FC<Props> = ({ invoice, onClose, payment }) => {
  const record = useRecordPayment();
  const update = useUpdatePayment();
  const remove = useDeletePayment();
  const { confirm, dialog } = useConfirm();
  const room = invoice.balance_due + (payment?.amount ?? 0);
  const [draft, setDraft] = useState<PayDraft>(() => payment
    ? { amount: String(payment.amount), payment_mode: payment.payment_mode, notes: payment.notes ?? '', payment_date: payment.payment_date }
    : blankPay(invoice.balance_due));
  const phone = invoice.booking?.customer?.phone ?? '';
  const [receipt, setReceipt] = useState(!payment && phone.replace(/\D/g, '').length >= 10);
  const [tried, setTried] = useState(false);
  const busy = record.isPending || update.isPending || remove.isPending;
  const amount = amountOf(draft.amount);
  const error = !(amount > 0) ? 'Enter the amount received' : amount > room ? `More than the ${inr(room)} still due` : '';
  const name = invoice.booking?.customer?.name ?? 'customer';
  const event = invoice.booking ? ` · ${invoice.booking.event_type} ${formatDateIST(invoice.booking.event_date, 'd MMM')}` : '';
  const left = Math.max(0, room - amount);

  const save = async () => {
    setTried(true);
    if (error) return;
    const day = draft.payment_date || todayIST();
    const payment_type = payment?.payment_type ?? ((invoice.booking?.event_date ?? '') > day ? 'advance' : 'partial');
    try {
      if (payment) await update.mutateAsync({ id: payment.id, invoiceId: invoice.id, amount, payment_type, payment_mode: draft.payment_mode, notes: draft.notes, payment_date: day });
      else await record.mutateAsync({ invoiceId: invoice.id, amount, payment_type, payment_mode: draft.payment_mode, notes: draft.notes, payment_date: day });
      toast.success(left > 0 ? `${inr(amount)} saved · ${inr(left)} still due` : `${name} has paid in full`);
      if (receipt && !openWhatsApp(phone, receiptText(invoice, amount, draft.payment_mode, day, left))) toast.error('WhatsApp did not open. Allow pop-ups and try again.');
      onClose();
    } catch (e) { toast.error(errorText(e)); }
  };

  const del = async () => {
    if (!payment) return;
    const ok = await confirm({ title: 'Delete this payment?', message: `${inr(payment.amount)} (${modeLabel(payment.payment_mode)}, ${formatDateIST(payment.payment_date, 'd MMM yyyy')}) will be removed and the balance goes up by the same amount.`, confirmLabel: 'Delete payment', danger: true });
    if (!ok) return;
    try { await remove.mutateAsync({ id: payment.id, invoiceId: invoice.id }); toast.success('Payment deleted'); onClose(); }
    catch (e) { toast.error(errorText(e)); }
  };

  const dirty = payment ? amount !== payment.amount || draft.payment_mode !== payment.payment_mode || draft.notes !== (payment.notes ?? '') || draft.payment_date !== payment.payment_date : amount !== invoice.balance_due || !!draft.notes;

  return (
    <Modal title={`${payment ? 'Change payment from' : 'Payment from'} ${name}`} onClose={onClose} width={440} dirty={dirty} busy={busy}
      footer={<>
        {payment && <button type="button" className="mx-link" style={{ color: '#A32D2D', marginRight: 'auto' }} onClick={del} disabled={busy}>Delete payment</button>}
        <button type="button" className="ui-btn" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className="ui-btn primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : `Save ${amount > 0 ? inr(amount) : ''}`.trim()}</button>
      </>}>
      <div className="mx-dlg">
        <p className="mx-dlg-sub">{invoice.invoice_number}{event} · balance {inr(invoice.balance_due)}</p>
        <PaymentFields value={draft} onChange={setDraft} balance={room} error={tried ? error : ''} />
        {!payment && phone && (
          <label className="mx-check"><input type="checkbox" checked={receipt} onChange={e => setReceipt(e.target.checked)} />Send a receipt on WhatsApp</label>
        )}
        {amount > 0 && amount <= room && (
          <div className="mx-after"><span className="mx-green">After this</span><span className={left > 0 ? 'mx-amber' : 'mx-green'}>{afterThis(room, amount)}</span></div>
        )}
      </div>
      {dialog}
    </Modal>
  );
};

export default PaymentFormModal;
