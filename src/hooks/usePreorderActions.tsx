import React, { useState } from 'react';
import toast from 'react-hot-toast';
import {
  SeasonalPreorder, useUpdateSeasonalPreorder, useUpdateSeasonalPreorderStatus, useDeleteSeasonalPreorder,
} from './useSeasonalPreorders';
import { useHasPreorderColumns, useHasSaleCancel, PACKED_STATUS_MIGRATION_FILE } from './useSchemaStatus';
import { useRole } from './useRole';
import { errorText, isStatusCheck } from '../lib/errors';
import { useConfirm } from '../components/ui/ConfirmDialog';
import CollectModal from '../components/pos/CollectModal';
import CancelSaleModal from '../components/pos/CancelSaleModal';
import { MenuItem } from '../components/pos/MoreMenu';
import { Refund, refundStart, cancelBookingFields, canCancelSale, canDeleteSale, deleteMessage } from '../lib/cancelSale';
import { balanceOf, STATUS_LABEL, PreStatus, packedToggle, istDay, bookingNumber } from '../lib/preorders';
import { PayMode, PayKind, preorderPayments, preorderLedger } from '../lib/payments';
import { sendReminder, advanceText } from '../lib/sessionalReceipts';
import { openWhatsApp } from '../lib/receipt';
import { inr } from '../lib/money';
import { roundMoney } from '../lib/units';

type Taking = { p: SeasonalPreorder; kind: Extract<PayKind, 'handover' | 'due'> };
// An older database rejects the Packed status until its one-time update is run.
const statusError = (e: unknown) => (isStatusCheck(e)
  ? `Packed is not saved yet: the database needs a one-time update. Run ${PACKED_STATUS_MIGRATION_FILE} in Supabase → SQL Editor.`
  : errorText(e));

// Packed, hand-over (a shortfall stays due), collecting that due later, reminders, cancel (any stage) and delete to the recycle bin.
export const usePreorderActions = () => {
  const update = useUpdateSeasonalPreorder();
  const setStatus = useUpdateSeasonalPreorderStatus();
  const del = useDeleteSeasonalPreorder();
  const extended = useHasPreorderColumns();
  const cancelCols = useHasSaleCancel();
  const role = useRole();
  const { confirm, dialog } = useConfirm();
  const [taking, setTaking] = useState<Taking | null>(null);
  const [cancelling, setCancelling] = useState<SeasonalPreorder | null>(null);

  const changeStatus = async (p: SeasonalPreorder, status: PreStatus) => {
    try { await setStatus.mutateAsync({ id: p.id, status }); toast.success(`${p.customer_name}: ${STATUS_LABEL[status]}`); } catch (e) { toast.error(statusError(e), { duration: 10000 }); }
  };

  const togglePacked = (p: SeasonalPreorder) => changeStatus(p, packedToggle(p));

  const cancel = async (reason: string, refund: Refund | null) => {
    const p = cancelling;
    if (!p) return;
    try {
      await update.mutateAsync({ id: p.id, ...cancelBookingFields(p, { reason, refund, at: new Date().toISOString() }, cancelCols) });
      toast.success(`${p.customer_name}: cancelled${refund ? ` · ${inr(refund.amount)} given back` : ''}`);
      setCancelling(null);
    } catch (e) { toast.error(statusError(e)); }
  };

  const remove = async (p: SeasonalPreorder) => {
    const what = `Pre-booking #${bookingNumber(p)} for ${p.customer_name} (${inr(p.total_amount)})`;
    if (!(await confirm({ title: `Delete pre-booking #${bookingNumber(p)}?`, message: deleteMessage(what), confirmLabel: 'Delete', danger: true }))) return;
    try { await del.mutateAsync(p.id); toast.success('Pre-booking moved to the recycle bin'); } catch (e) { toast.error(errorText(e)); }
  };

  // Cancel and Delete for any stage, as menu items; `first` runs before (e.g. closing the detail).
  const menuFor = (p: SeasonalPreorder, first: () => void = () => {}): MenuItem[] => [
    ...(p.status !== 'cancelled' && canCancelSale(role) ? [{ label: 'Cancel booking…', onClick: () => { first(); setCancelling(p); }, danger: true }] : []),
    ...(canDeleteSale(role) ? [{ label: 'Delete booking…', onClick: () => { first(); remove(p); }, danger: true }] : []),
  ];

  const remind = (p: SeasonalPreorder) => sendReminder(p.phone, p.customer_name, balanceOf(p), 'your sweets pre-booking');
  const askAdvance = (p: SeasonalPreorder) => openWhatsApp(p.phone, advanceText(p.customer_name, p.delivery_date || istDay(p.created_at), p.total_amount));

  const take = async (amount: number, mode: PayMode) => {
    if (!taking) return;
    const { p, kind } = taking;
    const at = new Date().toISOString();
    const payments = [...preorderPayments(p), ...(amount > 0 ? [{ amount, mode, at, kind }] : [])];
    const ledger = preorderLedger(payments);
    // Older databases only have one payment mode, so the money taken now replaces it there.
    const fields = extended ? ledger : { payments, advance_paid: ledger.advance_paid, payment_mode: amount > 0 ? mode : p.payment_mode };
    const handover = kind === 'handover' ? { status: 'delivered' as const, ...(extended ? { delivered_at: at } : {}) } : {};
    const left = roundMoney(p.total_amount - ledger.advance_paid);
    try {
      await update.mutateAsync({ id: p.id, ...fields, ...handover });
      toast.success(kind === 'handover'
        ? `Handed over to ${p.customer_name}${left > 0 ? ` · ${inr(left)} stays due` : ''}`
        : left > 0 ? `${inr(amount)} collected · ${inr(left)} still due` : `${p.customer_name} paid in full`);
      setTaking(null);
    } catch (e) { toast.error(errorText(e)); }
  };

  const modal = taking && (
    <CollectModal key={taking.p.id} due={balanceOf(taking.p)} busy={update.isPending} upiNote={`Pre-booking ${taking.p.customer_name}`}
      title={taking.kind === 'handover' ? `Hand over to ${taking.p.customer_name}` : `Collect from ${taking.p.customer_name}`}
      verb={taking.kind === 'handover' ? 'Hand over' : 'Collect'} allowNothing={taking.kind === 'handover'}
      info={<>Total {inr(taking.p.total_amount)} · Paid {inr(taking.p.advance_paid)} · Balance <b>{inr(balanceOf(taking.p))}</b></>}
      onPay={take} onClose={() => setTaking(null)} />
  );

  const cancelModal = cancelling && (
    <CancelSaleModal key={cancelling.id} noun="pre-booking" number={bookingNumber(cancelling)} name={cancelling.customer_name}
      refund={refundStart(preorderPayments(cancelling))} busy={update.isPending} onCancel={cancel} onClose={() => setCancelling(null)} />
  );

  return {
    changeStatus, togglePacked, remind, askAdvance, menuFor,
    startHandover: (p: SeasonalPreorder) => setTaking({ p, kind: 'handover' }),
    startCollect: (p: SeasonalPreorder) => setTaking({ p, kind: 'due' }),
    ui: <>{modal}{cancelModal}{dialog}</>,
  };
};
