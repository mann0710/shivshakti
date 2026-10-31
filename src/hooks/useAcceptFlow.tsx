import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Quotation, useQuotations, useUpdateQuotation, useUpdateQuotationStatus } from './useQuotations';
import { useUpdateBooking } from './useBookings';
import { useQuoteLifecycle } from './useQuoteLifecycle';
import { Navigate } from './useNavIntent';
import { acceptPatch } from '../lib/quoteChoices';
import { siblingsOf } from '../lib/quoteOptions';
import QuoteAcceptDialog from '../components/catering/QuoteAcceptDialog';
import SendDialog from '../components/quotes/SendDialog';
import { todayIST } from '../lib/ist';

type SendTarget = { q: Quotation; options: Quotation[]; all: boolean; prices: boolean };

// Accept (which option, dishes and advance) and Send (WhatsApp with the PDF) for any screen that shows quotes.
export const useAcceptFlow = (onNavigate?: Navigate) => {
  const { data: all = [] } = useQuotations();
  const lifecycle = useQuoteLifecycle(onNavigate);
  const updateQuotation = useUpdateQuotation();
  const updateStatus = useUpdateQuotationStatus();
  const updateBooking = useUpdateBooking();
  const [target, setTarget] = useState<{ q: Quotation; picks?: Set<string> } | null>(null);
  const [sending, setSending] = useState<SendTarget | null>(null);
  const [busy, setBusy] = useState(false);

  const accept = (q: Quotation, picks?: Set<string>) => setTarget({ q, picks });

  const confirm = async (chosen: Quotation, picked: Set<string>, guests?: number, advance?: { amount: number; mode: string }) => {
    setBusy(true);
    try {
      const patch = acceptPatch(chosen, picked, guests);
      await updateQuotation.mutateAsync({ id: chosen.id, ...patch });
      for (const s of siblingsOf(chosen, all)) {
        if (s.id !== chosen.id && s.status !== 'rejected') await updateStatus.mutateAsync({ id: s.id, status: 'rejected' });
      }
      if (guests && chosen.booking_id && chosen.booking?.guest_count !== guests) await updateBooking.mutateAsync({ id: chosen.booking_id, guest_count: guests });
      if (advance?.amount && chosen.booking_id) await updateBooking.mutateAsync({ id: chosen.booking_id, advance_received: advance.amount, advance_mode: advance.mode, advance_date: todayIST() });
      await lifecycle.setStatus({ ...chosen, ...patch } as Quotation, 'accepted');
      setTarget(null);
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
      {sending && (
        <SendDialog quote={sending.q} options={sending.options} all={sending.all} withPrices={sending.prices}
          onClose={() => setSending(null)} onSent={lifecycle.markSent} />
      )}
    </>
  );

  return {
    accept,
    setStatus: (q: Quotation, status: string) => (status === 'accepted' ? accept(q) : lifecycle.setStatus(q, status)),
    share,
    ui,
  };
};
