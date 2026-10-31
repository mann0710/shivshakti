import React, { useState } from 'react';
import toast from 'react-hot-toast';
import CollectModal from './CollectModal';
import CancelBillModal from './CancelBillModal';
import { SeasonalOrder, useUpdateSeasonalOrder, useDeleteSeasonalOrder, useHasPosPayments } from '../../hooks/useSeasonalOrders';
import { useConfirm } from '../ui/ConfirmDialog';
import { PayMode, billPayments, billLedger, refundEntries, paidOf, dueOf } from '../../lib/payments';
import { billDue, billPaid } from '../../lib/dues';
import { billNumber } from '../../lib/receipt';
import { sendReminder } from '../../lib/sessionalReceipts';
import { inr } from '../../lib/money';

const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Could not save');

// Collect (part) payments, remind on WhatsApp, cancel with a reason, and delete test bills.
export const useBillActions = () => {
  const update = useUpdateSeasonalOrder();
  const del = useDeleteSeasonalOrder();
  const ready = useHasPosPayments();
  const { confirm, dialog } = useConfirm();
  const [collecting, setCollecting] = useState<SeasonalOrder | null>(null);
  const [cancelling, setCancelling] = useState<SeasonalOrder | null>(null);
  const no = (o: SeasonalOrder) => billNumber(o.bill_no, o.id);

  const collect = async (amount: number, mode: PayMode) => {
    const o = collecting;
    if (!o) return;
    const payments = [...billPayments(o), { amount, mode, at: new Date().toISOString(), kind: 'due' as const }];
    try {
      await update.mutateAsync({ id: o.id, ...billLedger(o.total_amount, payments) });
      const left = dueOf(o.total_amount, payments);
      toast.success(left ? `${inr(amount)} collected · ${inr(left)} still due` : `${o.customer_name} paid in full`);
      setCollecting(null);
    } catch (e) { toast.error(errorText(e)); }
  };

  const cancel = async (reason: string, refunded: boolean) => {
    const o = cancelling;
    if (!o) return;
    const at = new Date().toISOString();
    const list = billPayments(o);
    const payments = refunded ? [...list, ...refundEntries(list, paidOf(list), at)] : list;
    try {
      await update.mutateAsync({ id: o.id, cancelled_at: at, cancel_reason: reason, ...billLedger(o.total_amount, payments, true) });
      toast.success(`Bill #${no(o)} cancelled`);
      setCancelling(null);
    } catch (e) { toast.error(errorText(e)); }
  };

  const remind = (o: SeasonalOrder) => sendReminder(o.phone, o.customer_name, billDue(o), `bill #${no(o)}`);

  const removeTest = async (o: SeasonalOrder) => {
    if (!(await confirm({ title: 'Delete test bill?', message: `Test bill #${no(o)} (${inr(o.total_amount)}) will be removed permanently.`, confirmLabel: 'Delete', danger: true }))) return;
    try { await del.mutateAsync(o.id); toast.success('Test bill deleted'); } catch (e) { toast.error(errorText(e)); }
  };

  const ui = (
    <>
      {collecting && (
        <CollectModal title={`Collect from ${collecting.customer_name}`} due={billDue(collecting)} busy={update.isPending}
          upiNote={`Bill ${no(collecting)}`} onPay={collect} onClose={() => setCollecting(null)}
          info={<>Bill #{no(collecting)} · Total {inr(collecting.total_amount)} · Paid {inr(billPaid(collecting))} · Due <b>{inr(billDue(collecting))}</b></>} />
      )}
      {cancelling && (
        <CancelBillModal number={no(cancelling)} name={cancelling.customer_name} paid={billPaid(cancelling)} busy={update.isPending}
          onCancel={cancel} onClose={() => setCancelling(null)} />
      )}
      {dialog}
    </>
  );

  return { canCancel: ready, startCollect: setCollecting, startCancel: setCancelling, remind, removeTest, ui };
};
