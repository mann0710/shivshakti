import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useDeletePayment, useUpdatePayment } from '../../hooks/useInvoices';
import { useConfirm } from '../ui/ConfirmDialog';
import { Payment } from '../../types';
import { formatDateIST } from '../../lib/ist';
import { inr } from '../../lib/money';
import PaymentFields, { PayDraft, blankPay, modeLabel } from './PaymentFields';
import { box, btnGhost, btnPrimary, xBtn } from './InvoiceUi';

interface Props { payments: Payment[] }

// Payments on an invoice with inline edit and confirmed delete.
const PaymentHistory: React.FC<Props> = ({ payments }) => {
  const updatePayment = useUpdatePayment();
  const deletePayment = useDeletePayment();
  const { confirm, dialog } = useConfirm();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PayDraft>(blankPay);

  const startEdit = (p: Payment) => {
    setEditingId(p.id);
    setDraft({ amount: String(p.amount), payment_type: p.payment_type, payment_mode: p.payment_mode, notes: p.notes || '', payment_date: p.payment_date });
  };

  const saveEdit = async (p: Payment) => {
    if (!(parseFloat(draft.amount) > 0)) { toast.error('Payment amount must be more than 0'); return; }
    try {
      await updatePayment.mutateAsync({
        id: p.id, invoiceId: p.invoice_id,
        amount: parseFloat(draft.amount),
        payment_type: draft.payment_type,
        payment_mode: draft.payment_mode as Payment['payment_mode'],
        notes: draft.notes, payment_date: draft.payment_date,
      });
      toast.success('Payment updated!'); setEditingId(null);
    } catch (e: any) { toast.error(e?.message || 'Failed to update'); }
  };

  const remove = async (p: Payment) => {
    const ok = await confirm({
      title: 'Delete payment?',
      message: `${inr(p.amount)} (${modeLabel(p.payment_mode)}, ${formatDateIST(p.payment_date, 'dd-MM-yyyy')}) will be removed and the balance due will go up by the same amount.`,
      confirmLabel: 'Delete', danger: true,
    });
    if (!ok) return;
    try {
      await deletePayment.mutateAsync({ id: p.id, invoiceId: p.invoice_id });
      toast.success('Payment deleted');
    } catch (e: any) { toast.error(e?.message || 'Failed to delete'); }
  };

  return (
    <div style={box}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#888880', marginBottom: 8 }}>PAYMENT HISTORY</div>
      {payments.length === 0 ? (
        <div style={{ fontSize: 12, color: '#BBBBBB' }}>No payments recorded yet</div>
      ) : payments.map(p => (
        <div key={p.id} style={{ borderBottom: '0.5px solid #E5E5E0', paddingBottom: 8, marginBottom: 8 }}>
          {editingId === p.id ? (
            <>
              <PaymentFields value={draft} onChange={setDraft} />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" onClick={() => setEditingId(null)} style={{ ...btnGhost, fontSize: 11, padding: '3px 10px' }}>Cancel</button>
                <button type="button" onClick={() => saveEdit(p)} disabled={updatePayment.isPending} style={{ ...btnPrimary, fontSize: 11, padding: '3px 10px' }}>
                  {updatePayment.isPending ? 'Saving…' : 'Save'}
                </button>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>₹{p.amount.toLocaleString()}</span>
                  <span style={{ fontSize: 10, background: p.payment_type === 'advance' ? '#EAF3DE' : '#E6F1FB', color: p.payment_type === 'advance' ? '#3B6D11' : '#185FA5', padding: '1px 7px', borderRadius: 12, fontWeight: 600 }}>
                    {p.payment_type === 'advance' ? 'Advance' : 'Partial'}
                  </span>
                  <span style={{ fontSize: 10, color: '#888880' }}>{modeLabel(p.payment_mode)}</span>
                </div>
                <div style={{ fontSize: 11, color: '#888880', marginTop: 2 }}>{formatDateIST(p.payment_date, 'dd-MM-yyyy')}</div>
                {p.notes && <div style={{ fontSize: 11, color: '#888880' }}>{p.notes}</div>}
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginLeft: 8, alignItems: 'center' }}>
                <button type="button" onClick={() => startEdit(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#378ADD', fontSize: 12 }}>✏ Edit</button>
                <button type="button" title="Delete payment" aria-label="Delete payment" onClick={() => remove(p)} style={{ ...xBtn, color: '#A32D2D', fontSize: 16 }}>×</button>
              </div>
            </div>
          )}
        </div>
      ))}
      {dialog}
    </div>
  );
};

export default PaymentHistory;
