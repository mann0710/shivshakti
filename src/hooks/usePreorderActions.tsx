import React, { useState } from 'react';
import toast from 'react-hot-toast';
import {
  SeasonalPreorder, useUpdateSeasonalPreorder, useUpdateSeasonalPreorderStatus, useDeleteSeasonalPreorder,
} from './useSeasonalPreorders';
import { useHasPreorderColumns } from './useSchemaStatus';
import { useConfirm } from '../components/ui/ConfirmDialog';
import Modal from '../components/ui/Modal';
import { balanceOf, STATUS_LABEL, PreStatus } from '../lib/preorders';
import { inr } from '../lib/money';
import { btnGhost, btnPrimary, inp, lbl } from '../components/ui/styles';

// Status changes, hand-over with balance collection and delete, shared by the list and the sheet.
export const usePreorderActions = () => {
  const update = useUpdateSeasonalPreorder();
  const setStatus = useUpdateSeasonalPreorderStatus();
  const del = useDeleteSeasonalPreorder();
  const extended = useHasPreorderColumns();
  const { confirm, dialog } = useConfirm();
  const [handing, setHanding] = useState<SeasonalPreorder | null>(null);
  const [amount, setAmount] = useState('');

  const changeStatus = async (p: SeasonalPreorder, status: PreStatus) => {
    if (status === 'cancelled' && !(await confirm({ title: 'Cancel pre-booking?', message: `${p.customer_name}'s booking of ${inr(p.total_amount)} will be marked cancelled.`, confirmLabel: 'Cancel booking', danger: true }))) return;
    try { await setStatus.mutateAsync({ id: p.id, status }); toast.success(`${p.customer_name}: ${STATUS_LABEL[status]}`); } catch (e: any) { toast.error(e.message); }
  };

  const togglePacked = (p: SeasonalPreorder) => changeStatus(p, p.status === 'ready' ? 'confirmed' : 'ready');

  const remove = async (p: SeasonalPreorder) => {
    if (!(await confirm({ title: 'Delete pre-booking?', message: `${p.customer_name} (${inr(p.total_amount)}) will be removed permanently.`, confirmLabel: 'Delete', danger: true }))) return;
    try { await del.mutateAsync(p.id); toast.success('Deleted'); } catch (e: any) { toast.error(e.message); }
  };

  const startHandover = (p: SeasonalPreorder) => { setHanding(p); setAmount(String(balanceOf(p))); };

  const handOver = async (mode: 'cash' | 'upi') => {
    if (!handing) return;
    const p = handing;
    const received = Math.min(balanceOf(p), Math.max(0, Number(amount) || 0));
    // Older databases only have one payment mode, so the hand-over mode replaces it there.
    const paid = extended
      ? { balance_paid: (p.balance_paid ?? 0) + received, balance_mode: received > 0 ? mode : p.balance_mode ?? null, delivered_at: new Date().toISOString() }
      : { payment_mode: received > 0 ? mode : p.payment_mode };
    try {
      await update.mutateAsync({ id: p.id, status: 'delivered', advance_paid: p.advance_paid + received, ...paid });
      toast.success(`Handed over to ${p.customer_name}`);
      setHanding(null);
    } catch (e: any) { toast.error(e.message); }
  };

  const modal = handing && (
    <Modal title={`Hand over to ${handing.customer_name}`} onClose={() => setHanding(null)} width={380}
      footer={<button style={btnGhost} onClick={() => setHanding(null)}>Cancel</button>}>
      <div style={{ fontSize: 13, marginBottom: 10 }}>
        Total {inr(handing.total_amount)} · Paid {inr(handing.advance_paid)} · Balance <b>{inr(balanceOf(handing))}</b>
      </div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
        <span style={lbl}>Amount received now (₹)</span>
        <input style={inp} inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} autoFocus onFocus={e => e.target.select()} />
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={{ ...btnPrimary, flex: 1, height: 46 }} disabled={update.isPending} onClick={() => handOver('cash')}>Paid by Cash</button>
        <button style={{ ...btnPrimary, flex: 1, height: 46 }} disabled={update.isPending} onClick={() => handOver('upi')}>Paid by UPI</button>
      </div>
    </Modal>
  );

  return { changeStatus, togglePacked, remove, startHandover, ui: <>{modal}{dialog}</> };
};
