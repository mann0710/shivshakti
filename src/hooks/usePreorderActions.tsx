import React, { useState } from 'react';
import toast from 'react-hot-toast';
import {
  SeasonalPreorder, useUpdateSeasonalPreorder, useUpdateSeasonalPreorderStatus, useDeleteSeasonalPreorder,
} from './useSeasonalPreorders';
import { useHasPreorderColumns } from './useSchemaStatus';
import { useConfirm } from '../components/ui/ConfirmDialog';
import CollectModal from '../components/pos/CollectModal';
import { balanceOf, STATUS_LABEL, PreStatus, packedToggle, istDay } from '../lib/preorders';
import { PayMode, PayKind, preorderPayments, preorderLedger } from '../lib/payments';
import { sendReminder, advanceText } from '../lib/sessionalReceipts';
import { openWhatsApp } from '../lib/receipt';
import { inr } from '../lib/money';
import { roundMoney } from '../lib/units';

type Taking = { p: SeasonalPreorder; kind: Extract<PayKind, 'handover' | 'due'> };
const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Could not save');

// Packed / cancelled, hand-over (a shortfall stays due), collecting that due later, reminders and delete.
export const usePreorderActions = () => {
  const update = useUpdateSeasonalPreorder();
  const setStatus = useUpdateSeasonalPreorderStatus();
  const del = useDeleteSeasonalPreorder();
  const extended = useHasPreorderColumns();
  const { confirm, dialog } = useConfirm();
  const [taking, setTaking] = useState<Taking | null>(null);

  const changeStatus = async (p: SeasonalPreorder, status: PreStatus) => {
    if (status === 'cancelled' && !(await confirm({ title: 'Cancel pre-booking?', message: `${p.customer_name}'s booking of ${inr(p.total_amount)} will be marked cancelled.`, confirmLabel: 'Cancel booking', danger: true }))) return;
    try { await setStatus.mutateAsync({ id: p.id, status }); toast.success(`${p.customer_name}: ${STATUS_LABEL[status]}`); } catch (e) { toast.error(errorText(e)); }
  };

  const togglePacked = (p: SeasonalPreorder) => changeStatus(p, packedToggle(p));

  const remove = async (p: SeasonalPreorder) => {
    if (!(await confirm({ title: 'Delete pre-booking?', message: `${p.customer_name} (${inr(p.total_amount)}) will be removed permanently.`, confirmLabel: 'Delete', danger: true }))) return;
    try { await del.mutateAsync(p.id); toast.success('Deleted'); } catch (e) { toast.error(errorText(e)); }
  };

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

  return {
    changeStatus, togglePacked, remove, remind, askAdvance,
    startHandover: (p: SeasonalPreorder) => setTaking({ p, kind: 'handover' }),
    startCollect: (p: SeasonalPreorder) => setTaking({ p, kind: 'due' }),
    ui: <>{modal}{dialog}</>,
  };
};
