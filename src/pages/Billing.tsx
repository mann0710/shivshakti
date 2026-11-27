import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useInvoices } from '../hooks/useInvoices';
import { useQuotations } from '../hooks/useQuotations';
import { useBookings } from '../hooks/useBookings';
import { Navigate, useNavIntent, canGoBack } from '../hooks/useNavIntent';
import { useRecordRoute } from '../hooks/useRoute';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { Invoice } from '../types';
import { todayIST } from '../lib/ist';
import { inr } from '../lib/money';
import { invoiceTodo, Ready } from '../lib/cateringTodo';
import { pickQuotation } from '../lib/quoteMath';
import { awaitsAcceptance, quoteNotConfirmed } from '../lib/moneyView';
import { useAcceptFlow } from '../hooks/useAcceptFlow';
import InvoiceTodo from '../components/catering/InvoiceTodo';
import InvoiceList, { invoiceMatches } from '../components/catering/InvoiceList';
import InvoiceEditor from '../components/catering/InvoiceEditor';
import InvoiceCreateModal from '../components/catering/InvoiceCreateModal';
import InvoiceSettle, { useSettleOutside } from '../components/catering/InvoiceSettle';
import PaymentDialog, { bookingOfInvoice } from '../components/catering/PaymentDialog';
import { Empty, LoadError, Skeleton } from '../components/money/MoneyUi';

interface Props { onNavigate?: Navigate }

// Invoices: who still owes, what is ready to invoice, past events never invoiced; one invoice opens full page.
const Billing: React.FC<Props> = ({ onNavigate }) => {
  const intent = useNavIntent('billing');
  const { data: invoices = [], isLoading, error, refetch } = useInvoices();
  const { data: quotations = [] } = useQuotations();
  const { data: bookings = [] } = useBookings();
  const { settle, busy: settlingAll } = useSettleOutside();
  const { confirm, dialog } = useConfirm();
  // The open invoice lives in the address: /invoices/<id>.
  const route = useRecordRoute('billing');
  // Opened from another screen: Back returns there instead of the list.
  const [linked, setLinked] = useState(() => intent?.action === 'open' && canGoBack());
  const [creating, setCreating] = useState<string | null>(intent?.action === 'new' ? intent.id ?? '' : null);
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [settling, setSettling] = useState<Ready | null>(null);
  const [q, setQ] = useState('');
  const [showAll, setShowAll] = useState(false);
  const flow = useAcceptFlow(onNavigate);
  const today = todayIST();
  const todo = useMemo(() => {
    // Cancelled bookings' invoices stay out, as on Home and Money.
    const t = invoiceTodo(bookings, quotations, invoices.filter(i => i.booking?.status !== 'cancelled'), today);
    const open = t.ready.filter(r => !awaitsAcceptance(r.booking.id, quotations));
    return { ...t, ready: open.filter(r => !quoteNotConfirmed(r.booking.id, quotations)), toConfirm: open.filter(r => quoteNotConfirmed(r.booking.id, quotations)) };
  }, [bookings, quotations, invoices, today]);
  const owed = todo.owing.reduce((s, o) => s + o.invoice.balance_due, 0);
  const open = invoices.find(i => i.id === route.id);
  const openInvoice = (id: string) => { setLinked(false); route.open(id); };
  const bookingOf = (id: string) => bookings.find(b => b.id === id);

  const settleAll = async () => {
    const n = todo.past.length;
    const ok = await confirm({ title: `Mark ${n} past events as settled outside?`, confirmLabel: `Mark ${n} as settled`,
      message: `Each gets a paid invoice for its quoted amount (${inr(todo.pastValue)} in all), dated on the event day, so Money adds up. You can open and change any of them later.` });
    if (!ok) return;
    const id = toast.loading(`Settling 0 of ${n}…`);
    let done = 0;
    for (const r of todo.past) {
      const b = bookingOf(r.booking.id);
      if (!b) continue;
      try { await settle(b, pickQuotation(quotations, b.id)); done += 1; toast.loading(`Settling ${done} of ${n}…`, { id }); }
      catch (e) { toast.error(`${b.customer?.name ?? 'An event'}: ${e instanceof Error ? e.message : 'could not save'}`, { id }); return; }
    }
    toast.success(`${done} past events marked as settled`, { id });
  };

  if (open) return <InvoiceEditor key={open.id} invoice={open} onBack={route.close} onDeleted={() => route.open(undefined, true)} backLabel={linked ? 'Back' : undefined} />;

  const matches = q.trim() ? invoices.filter(i => invoiceMatches(i, q)) : [];
  const settleBooking = settling ? bookingOf(settling.booking.id) : undefined;

  return (
    <div className="mx-page">
      <div className="mx-head iv-head">
        <div className="mx-head-l">
          <h1>Invoices</h1>
          <span className="mx-sub">{inr(owed)} to collect · {todo.ready.length} event{todo.ready.length === 1 ? '' : 's'} ready to invoice</span>
        </div>
        <div className="mx-head-r">
          <label className="iv-search">
            <span aria-hidden="true" className="mx-sub">⌕</span>
            <input type="search" aria-label="Search invoices" placeholder="Name, phone or INV number" value={q} onChange={e => setQ(e.target.value)} />
          </label>
          <button type="button" className="ui-btn primary iv-new" onClick={() => setCreating('')}>+ New<span className="mx-long"> invoice</span></button>
        </div>
      </div>

      {error && <LoadError onRetry={() => refetch()} />}
      {isLoading ? <Skeleton rows={4} /> : q.trim() ? (
        <InvoiceList title="Matches" invoices={matches} onOpen={i => openInvoice(i.id)}
          empty={<Empty title={`Nothing matches "${q.trim()}"`} text="Search looks at names, phones and invoice numbers.">
            <button type="button" className="ui-btn" onClick={() => setQ('')}>Clear search</button></Empty>} />
      ) : (
        <>
          <InvoiceTodo {...todo} invoices={invoices} onOpen={i => openInvoice(i.id)} onPay={setPaying}
            onCreate={id => setCreating(id)} onConfirm={r => { const q = quotations.find(x => x.id === r.quote?.id); if (q) flow.accept(q); }} onSettle={setSettling} onSettleAll={() => { if (!settlingAll) settleAll(); }} />
          <InvoiceList title="All invoices" invoices={invoices} onOpen={i => openInvoice(i.id)} collapsed={!showAll} onToggle={() => setShowAll(v => !v)} />
        </>
      )}

      {creating !== null && (
        <InvoiceCreateModal bookingId={creating || undefined} onClose={() => setCreating(null)} onCreated={id => { setCreating(null); openInvoice(id); }} />
      )}
      {paying && <PaymentDialog booking={bookingOfInvoice(paying)} invoice={paying} onClose={() => setPaying(null)} />}
      {settling && settleBooking && (
        <InvoiceSettle item={settling} booking={settleBooking} quote={pickQuotation(quotations, settleBooking.id)} onClose={() => setSettling(null)}
          onInvoice={id => { setSettling(null); setCreating(id); }} onDone={() => setSettling(null)} />
      )}
      {flow.ui}
      {dialog}
    </div>
  );
};

export default Billing;
