import React, { useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import { useRecordPayment } from '../../hooks/useInvoices';
import { Invoice } from '../../types';
import { todayIST } from '../../lib/ist';
import PaymentFields, { blankPay } from './PaymentFields';
import { btnGhost, btnPrimary } from './InvoiceUi';

interface Props { invoice: Invoice; onClose: () => void }

// Records a payment against an invoice's balance due.
const PaymentFormModal: React.FC<Props> = ({ invoice, onClose }) => {
  const recordPayment = useRecordPayment();
  const [payForm, setPayForm] = useState(blankPay);

  const handlePayment = async () => {
    if (!payForm.amount) { toast.error('Enter payment amount'); return; }
    const amount = parseFloat(payForm.amount);
    if (!(amount > 0)) { toast.error('Payment amount must be more than 0'); return; }
    if (amount > invoice.balance_due) {
      toast.error(`Amount cannot exceed balance due ₹${invoice.balance_due.toLocaleString()}`); return;
    }
    try {
      await recordPayment.mutateAsync({
        invoiceId: invoice.id, amount,
        payment_type: payForm.payment_type, payment_mode: payForm.payment_mode,
        notes: payForm.notes, payment_date: payForm.payment_date || todayIST(),
      });
      toast.success('Payment recorded!');
      onClose();
    } catch (e: any) { toast.error(e?.message || 'Failed to record payment'); }
  };

  return (
    <Modal title={`Record payment · ${invoice.invoice_number}`} onClose={onClose} width={440}
      footer={<>
        <button type="button" style={btnGhost} onClick={onClose}>Cancel</button>
        <button type="button" style={{ ...btnPrimary, opacity: recordPayment.isPending ? 0.6 : 1 }} disabled={recordPayment.isPending} onClick={handlePayment}>
          {recordPayment.isPending ? 'Saving…' : 'Save Payment'}
        </button>
      </>}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 12, color: '#888880', flexWrap: 'wrap' }}>
        <span>{invoice.booking?.customer?.name} · Balance due: <strong style={{ color: '#A32D2D' }}>₹{invoice.balance_due.toLocaleString()}</strong></span>
        <button type="button" style={{ ...btnGhost, fontSize: 11, padding: '3px 10px' }}
          onClick={() => setPayForm(f => ({ ...f, amount: String(invoice.balance_due) }))}>Full balance</button>
      </div>
      <PaymentFields value={payForm} onChange={setPayForm} maxAmount={invoice.balance_due} />
    </Modal>
  );
};

export default PaymentFormModal;
