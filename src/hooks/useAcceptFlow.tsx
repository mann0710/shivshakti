import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Quotation, useQuotations, useUpdateQuotation, useUpdateQuotationStatus } from './useQuotations';
import { useUpdateBooking } from './useBookings';
import { useQuoteLifecycle } from './useQuoteLifecycle';
import { useStoredState } from './useStoredState';
import { Navigate } from './useNavIntent';
import { acceptPatch } from '../lib/quoteChoices';
import { siblingsOf } from '../lib/quoteOptions';
import QuoteAcceptDialog from '../components/catering/QuoteAcceptDialog';
import SendDialog from '../components/quotes/SendDialog';
import { todayIST } from '../lib/ist';
import { useSavePayment } from './useBookingPayments';
import { payTypeOn } from '../lib/bookingMoney';
import { amountOf } from '../lib/invoiceEdit';
import { ReceiptInfo } from '../lib/bookingReceipt';
import { SHOP } from '../lib/shop';
import { PayDraft } from '../components/catering/PaymentFields';
import ReceiptDialog from '../components/catering/ReceiptDialog';

type SendTarget = { q: Quotation; options: Quotation[]; all: boolean; prices: boolean };

// "Show each dish's price" on the quote PDF, remembered across screens.
export const useQuotePdfPref = () => useStoredState('shivshakti.quotePdf', () => ({ prices: true }));

// Accept (which option, dishes and advance) and Send (WhatsApp with the PDF) for any screen that shows quotes.
export const useAcceptFlow = (onNavigate?: Navigate) => {
  const { data: all = [] } = useQuotations();
  const lifecycle = useQuoteLifecycle(onNavigate);
  const updateQuotation = useUpdateQuotation();
  const updateStatus = useUpdateQuotationStatus();
  const updateBooking = useUpdateBooking();
  const savePayment = useSavePayment();
  const [receipt, setReceipt] = useState<{ phone: string; info: ReceiptInfo } | null>(null);
  const [target, setTarget] = useState<{ q: Quotation; picks?: Set<string> } | null>(null);
  const [sending, setSending] = useState<SendTarget | null>(null);
  const [busy, setBusy] = useState(false);

  const accept = (q: Quotation, picks?: Set<string>) => setTarget({ q, picks });

  const confirm = async (chosen: Quotation, picked: Set<string>, guests?: number, advance?: { draft: PayDraft; receipt: boolean }) => {
    setBusy(true);
    try {
      const patch = acceptPatch(chosen, picked, guests);
      await updateQuotation.mutateAsync({ id: chosen.id, ...patch });
      for (const s of siblingsOf(chosen, all)) {
        if (s.id !== chosen.id && s.status !== 'rejected') await updateStatus.mutateAsync({ id: s.id, status: 'rejected' });
      }
      if (guests && chosen.booking_id && chosen.booking?.guest_count !== guests) await updateBooking.mutateAsync({ id: chosen.booking_id, guest_count: guests });
      // The advance is a payment on the booking, like any other.
      const amount = amountOf(advance?.draft.amount ?? '');
      const b = chosen.booking;
      const day = advance?.draft.payment_date || todayIST();
      if (amount > 0 && chosen.booking_id) await savePayment.mutateAsync({ bookingId: chosen.booking_id, amount, payment_type: payTypeOn(b?.event_date ?? day, day), payment_mode: advance!.draft.payment_mode, notes: advance!.draft.notes, payment_date: day });
      await lifecycle.setStatus([{ ...chosen, ...patch } as Quotation], 'accepted');
      setTarget(null);
      const phone = chosen.customer?.phone ?? '';
      if (amount > 0 && advance?.receipt && phone.replace(/\D/g, '').length >= 10 && b) {
        const total = patch.total_amount ?? chosen.total_amount;
        setReceipt({ phone, info: { name: chosen.customer?.name ?? '', amount, mode: advance.draft.payment_mode, day, advance: b.event_date > day, event: b.event_type, eventDate: b.event_date, total, received: amount, shop: SHOP.name } });
      }
    } catch (e: any) { toast.error(e?.message || 'Could not accept'); }
    finally { setBusy(false); }
  };

  // Opens the Send dialog; `options` set = the whole enquiry can go in one PDF (picked first unless `startAll` is false).
  const share = (q: Quotation, withPrices?: boolean, options?: Quotation[], startAll = true) => {
    const sibs = options?.length ? options : siblingsOf(q, all);
    setSending({ q, options: sibs.length > 1 ? sibs : [q], all: startAll && !!options && options.length > 1, prices: withPrices ?? true });
  };

  const ui = (
    <>
      {target && (
        <QuoteAcceptDialog quote={target.q} options={siblingsOf(target.q, all)} picks={target.picks} busy={busy}
          onClose={() => setTarget(null)} onConfirm={confirm} />
      )}
      {receipt && <ReceiptDialog phone={receipt.phone} info={receipt.info} onClose={() => setReceipt(null)} />}
      {sending && (
        <SendDialog quote={sending.q} options={sending.options} all={sending.all} withPrices={sending.prices}
          onClose={() => setSending(null)} onSent={lifecycle.markSent} />
      )}
    </>
  );

  return {
    accept,
    setStatus: (list: Quotation[], status: string) => (status === 'accepted' ? accept(list[0]) : lifecycle.setStatus(list, status)),
    share,
    ui,
  };
};
