import React, { useState } from 'react';
import { Invoice } from '../../types';
import { MoneyData, Debt } from '../../lib/moneyView';
import { sendReminder } from '../../lib/sessionalReceipts';
import { useBillActions } from '../pos/useBillActions';
import { usePreorderActions } from '../../hooks/usePreorderActions';
import PaymentFormModal from '../catering/PaymentFormModal';
import { whatsApp } from '../catering/InvoiceActions';
import { inr } from '../../lib/money';

// Remind and Record payment for anyone who owes: catering invoices, sweets bills and handed-over pre-bookings.
export function useCollect(d: MoneyData) {
  const bills = useBillActions();
  const pre = usePreorderActions();
  const [paying, setPaying] = useState<Invoice | null>(null);

  const remind = (x: Debt) => {
    if (x.kind === 'bill') { const o = d.orders.find(y => y.id === x.id); if (o) bills.remind(o); return; }
    if (x.kind === 'preorder') { const p = d.preorders.find(y => y.id === x.id); if (p) pre.remind(p); return; }
    const inv = d.invoices.find(i => i.id === x.id);
    const what = `invoice ${inv?.invoice_number ?? ''}`.trim();
    if (x.phone.replace(/\D/g, '').length >= 10) sendReminder(x.phone, x.name, x.amount, what);
    else whatsApp(x.phone, `${inr(x.amount)} is due for ${what}.`);
  };

  const record = (x: Debt) => {
    if (x.kind === 'bill') { const o = d.orders.find(y => y.id === x.id); if (o) bills.startCollect(o); return; }
    if (x.kind === 'preorder') { const p = d.preorders.find(y => y.id === x.id); if (p) pre.startCollect(p); return; }
    setPaying(d.invoices.find(i => i.id === x.id) ?? null);
  };

  const ui = (
    <>
      {paying && <PaymentFormModal invoice={paying} onClose={() => setPaying(null)} />}
      {bills.ui}
      {pre.ui}
    </>
  );
  return { remind, record, payInvoice: setPaying, ui };
}
