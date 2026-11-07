import React, { useState } from 'react';
import toast from 'react-hot-toast';
import CollectModal from './CollectModal';
import CancelSaleModal from './CancelSaleModal';
import { MenuItem } from './MoreMenu';
import { SeasonalOrder, useUpdateSeasonalOrder, useDeleteSeasonalOrder, useHasPosPayments } from '../../hooks/useSeasonalOrders';
import { useConfirm } from '../ui/ConfirmDialog';
import { PayMode, billPayments, billLedger, dueOf } from '../../lib/payments';
import { Refund, refundStart, cancelBillFields, canCancelSale, canDeleteSale, deleteMessage } from '../../lib/cancelSale';
import { useHasSaleCancel } from '../../hooks/useSchemaStatus';
import { useRole } from '../../hooks/useRole';
import { billDue, billPaid, isTestBill } from '../../lib/dues';
import { billNumber } from '../../lib/receipt';
import { sendReminder } from '../../lib/sessionalReceipts';
import { inr } from '../../lib/money';
import { errorText } from '../../lib/errors';

// Collect (part) payments, remind on WhatsApp, cancel with a reason and refund, and delete (to the recycle bin once it covers bills).
export const useBillActions = () => {
  const update = useUpdateSeasonalOrder();
  const del = useDeleteSeasonalOrder();
  const ready = useHasPosPayments();
  const binned = useHasSaleCancel();
  const role = useRole();
  const canCancel = ready && canCancelSale(role);
  // Test bills may always go; real ones only by owners once the recycle bin keeps bills.
  const canDelete = (o: SeasonalOrder) => isTestBill(o) || (binned && canDeleteSale(role));
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

  const cancel = async (reason: string, refund: Refund | null) => {
    const o = cancelling;
    if (!o) return;
    try {
      await update.mutateAsync({ id: o.id, ...cancelBillFields(o, { reason, refund, at: new Date().toISOString() }) });
      toast.success(`Bill #${no(o)} cancelled${refund ? ` · ${inr(refund.amount)} given back` : ''}`);
      setCancelling(null);
    } catch (e) { toast.error(errorText(e)); }
  };

  const remind = (o: SeasonalOrder) => sendReminder(o.phone, o.customer_name, billDue(o), `bill #${no(o)}`);

  const remove = async (o: SeasonalOrder) => {
    const what = `Bill #${no(o)} for ${o.customer_name} (${inr(o.total_amount)})`;
    const message = binned ? `${deleteMessage(what)} Its number is not reused.` : `${what} will be removed permanently.`;
    if (!(await confirm({ title: `Delete bill #${no(o)}?`, message, confirmLabel: 'Delete', danger: true }))) return;
    try { await del.mutateAsync(o.id); toast.success(binned ? 'Bill moved to the recycle bin' : 'Bill deleted'); } catch (e) { toast.error(errorText(e)); }
  };

  // Cancel and Delete for a bill's ⋯ More menu.
  const menuFor = (o: SeasonalOrder): MenuItem[] => [
    ...(!o.cancelled_at && canCancel ? [{ label: 'Cancel bill…', onClick: () => setCancelling(o), danger: true }] : []),
    ...(canDelete(o) ? [{ label: 'Delete bill…', onClick: () => remove(o), danger: true }] : []),
  ];

  const ui = (
    <>
      {collecting && (
        <CollectModal title={`Collect from ${collecting.customer_name}`} due={billDue(collecting)} busy={update.isPending}
          upiNote={`Bill ${no(collecting)}`} onPay={collect} onClose={() => setCollecting(null)}
          info={<>Bill #{no(collecting)} · Total {inr(collecting.total_amount)} · Paid {inr(billPaid(collecting))} · Due <b>{inr(billDue(collecting))}</b></>} />
      )}
      {cancelling && (
        <CancelSaleModal noun="bill" number={no(cancelling)} name={cancelling.customer_name} refund={refundStart(billPayments(cancelling))}
          busy={update.isPending} onCancel={cancel} onClose={() => setCancelling(null)} />
      )}
      {dialog}
    </>
  );

  return { startCollect: setCollecting, remind, menuFor, ui };
};
