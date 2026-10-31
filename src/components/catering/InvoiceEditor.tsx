import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Invoice, Payment } from '../../types';
import { useQuotations } from '../../hooks/useQuotations';
import { useDataCenter } from '../../hooks/useDataCenter';
import { useDeleteInvoice, usePaymentHistory } from '../../hooks/useInvoices';
import { useConfirm } from '../ui/ConfirmDialog';
import { formatDateIST, todayIST } from '../../lib/ist';
import { inr } from '../../lib/money';
import { MealRow, editMeal, mealRows, payState, PAY_CHIP, paymentPlan } from '../../lib/invoiceEdit';
import { Chip, Tile } from '../money/MoneyUi';
import { useInvoiceDraft } from './InvoiceDraft';
import { useInvoiceSend } from './InvoiceActions';
import InvoiceSchedule from './InvoiceSchedule';
import InvoiceChargeList from './InvoiceChargeList';
import InvoiceTotals from './InvoiceTotals';
import PaymentHistory from './PaymentHistory';
import PaymentFormModal from './PaymentFormModal';

// backLabel replaces "Invoices" when Back returns to another screen.
interface Props { invoice: Invoice; onBack: () => void; onDeleted: () => void; backLabel?: string }

const SAVE_TEXT = { saved: 'all changes saved', saving: 'saving…', error: 'not saved' };

// One invoice: meals with final counts, extras, payments and the summary; changes save by themselves.
const InvoiceEditor: React.FC<Props> = ({ invoice, onBack, onDeleted, backLabel }) => {
  const { data: quotations = [] } = useQuotations();
  const { data: dc } = useDataCenter();
  const { data: payments = [] } = usePaymentHistory(invoice.id);
  const del = useDeleteInvoice();
  const { confirm, dialog } = useConfirm();
  const quote = quotations.find(q => q.id === invoice.quotation_id);
  const plateRate = quote?.per_plate_amount ?? 0;
  const { draft, change, status, flush, retry } = useInvoiceDraft(invoice, plateRate);
  const send = useInvoiceSend(invoice, quote, payments);
  const [paying, setPaying] = useState<Payment | 'new' | null>(null);
  const b = invoice.booking;
  const name = b?.customer?.name ?? 'Customer';
  const st = payState(invoice);

  const rows = useMemo(() => mealRows({ ...invoice, subtotal: draft.guests !== null ? plateRate * draft.guests : invoice.subtotal }, draft.days, plateRate),
    [invoice, draft.days, draft.guests, plateRate]);
  const plan = useMemo(() => paymentPlan(payments, invoice, b?.event_date, todayIST()), [payments, invoice, b?.event_date]);
  const registered = !!dc?.gst_number;
  const gstRates = Array.from(new Set(registered ? [0, 5, 18, dc?.gst_rate ?? 18, invoice.gst_rate || 0] : [0, invoice.gst_rate || 0])).sort((x, y) => x - y);
  const gstNote = draft.gst ? `${draft.gst}% on the meals` : registered ? 'not added' : 'add your GSTIN in Settings first';

  const editRow = (r: MealRow, patch: { guests?: number; rate?: number }) =>
    r.day >= 0 ? change({ days: editMeal(draft.days, r.day, r.meal, patch) }) : change({ guests: patch.guests ?? r.guests });
  const back = async () => { await flush(); onBack(); };
  const remove = async () => {
    const paid = invoice.advance_paid > 0 ? ` Its payments (${inr(invoice.advance_paid)}) are deleted too.` : '';
    if (!(await confirm({ title: `Delete ${invoice.invoice_number}?`, message: `The invoice for ${name} (${inr(invoice.total_amount)}) is removed for good.${paid}`, confirmLabel: 'Delete invoice', danger: true }))) return;
    try { await del.mutateAsync(invoice.id); toast.success(`${invoice.invoice_number} deleted`); onDeleted(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Could not delete'); }
  };
  const record = () => setPaying('new');
  const owed = invoice.balance_due > 0;

  return (
    <div>
      <header className="iv-top">
        <button type="button" className="mx-link iv-back" onClick={back} aria-label={backLabel ?? 'Back to Invoices'}>← <span className="desk">{backLabel ?? 'Invoices'}</span></button>
        <span className="sep" />
        <span className="mx-two-line" style={{ flex: '1 1 260px' }}>
          <b style={{ fontSize: 16 }}>{invoice.invoice_number} · {name}</b>
          <span>
            {[b?.event_type, b ? formatDateIST(b.event_date, 'EEE d MMM') : '', quote ? `from ${quote.quotation_number}` : ''].filter(Boolean).join(' · ')}
            {' · '}<span className={status === 'error' ? 'mx-red' : undefined} role="status">{SAVE_TEXT[status]}</span>
            {status === 'error' && <> · <button type="button" className="mx-link" style={{ minHeight: 0 }} onClick={retry}>Try again</button></>}
          </span>
        </span>
        <span className="desk"><Chip bg={PAY_CHIP[st].bg} fg={PAY_CHIP[st].fg}>{st}</Chip></span>
        <button type="button" className="ui-btn desk" onClick={send.preview}>Preview PDF</button>
        <button type="button" className="ui-btn primary desk" onClick={send.openSend}>Send…</button>
      </header>

      <div className="iv-body">
        <div className="iv-main">
          <div className="mx-tiles iv-tiles-phone" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <Tile label="Total" value={inr(invoice.total_amount)} />
            <Tile label="Balance" value={inr(invoice.balance_due)} tone={invoice.balance_due > 0 ? 'red' : 'green'} />
          </div>
          <InvoiceSchedule rows={rows} onEdit={editRow} />
          <InvoiceChargeList extras={draft.extras} transport={draft.transport} onExtras={extras => change({ extras })} onTransport={transport => change({ transport })}
            discount={draft.discount} onDiscount={discount => change({ discount })} gstRate={draft.gst} gstRates={gstRates} gstNote={gstNote} onGst={gst => change({ gst })} />
          <PaymentHistory rows={plan} onRecord={owed ? record : undefined} onEdit={setPaying} />
        </div>

        <aside aria-label="Summary" className="iv-side">
          <InvoiceTotals invoice={invoice} />
          <div className="iv-sec desk">
            <button type="button" className="ui-btn primary iv-main-btn" onClick={record} disabled={!owed}>{owed ? 'Record payment' : 'Paid in full'}</button>
            <span className="mx-sub">Each change saves by itself. Send… shares the invoice or a payment reminder; the PDF lists every payment and a UPI QR for the balance.</span>
          </div>
          <button type="button" className="mx-link" style={{ color: '#A32D2D', alignSelf: 'flex-start' }} onClick={remove} disabled={del.isPending}>Delete invoice</button>
        </aside>
      </div>

      <div className="iv-bar">
        <button type="button" className="ui-btn" onClick={send.openSend}>Send…</button>
        <button type="button" className="ui-btn primary" onClick={record} disabled={!owed}>{owed ? 'Record payment' : 'Paid in full'}</button>
      </div>

      {paying && <PaymentFormModal invoice={invoice} payment={paying === 'new' ? undefined : paying} onClose={() => setPaying(null)} />}
      {send.ui}
      {dialog}
    </div>
  );
};

export default InvoiceEditor;
