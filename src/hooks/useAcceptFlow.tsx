import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Quotation, useQuotations, useUpdateQuotation, useUpdateQuotationStatus } from './useQuotations';
import { useUpdateBooking } from './useBookings';
import { useQuoteLifecycle } from './useQuoteLifecycle';
import { Navigate } from './useNavIntent';
import { acceptPatch, quoteDishes } from '../lib/quoteChoices';
import { siblingsOf } from '../lib/quoteOptions';
import QuoteAcceptDialog from '../components/catering/QuoteAcceptDialog';

// Accepting a quote with options or "choose any" groups asks which option and which dishes first.
export const useAcceptFlow = (onNavigate?: Navigate) => {
  const { data: all = [] } = useQuotations();
  const lifecycle = useQuoteLifecycle(onNavigate);
  const updateQuotation = useUpdateQuotation();
  const updateStatus = useUpdateQuotationStatus();
  const updateBooking = useUpdateBooking();
  const [target, setTarget] = useState<Quotation | null>(null);
  const [busy, setBusy] = useState(false);

  const needsDialog = (q: Quotation) => siblingsOf(q, all).length > 1 || quoteDishes(q).some(d => d.item.choice);
  const accept = (q: Quotation) => (needsDialog(q) ? setTarget(q) : lifecycle.setStatus(q, 'accepted'));

  const confirm = async (chosen: Quotation, picked: Set<string>, guests?: number) => {
    setBusy(true);
    try {
      const patch = acceptPatch(chosen, picked, guests);
      await updateQuotation.mutateAsync({ id: chosen.id, ...patch });
      for (const s of siblingsOf(chosen, all)) {
        if (s.id !== chosen.id && s.status !== 'rejected') await updateStatus.mutateAsync({ id: s.id, status: 'rejected' });
      }
      if (guests && chosen.booking_id && chosen.booking?.guest_count !== guests) await updateBooking.mutateAsync({ id: chosen.booking_id, guest_count: guests });
      await lifecycle.setStatus({ ...chosen, ...patch } as Quotation, 'accepted');
      setTarget(null);
    } catch (e: any) { toast.error(e?.message || 'Could not accept'); }
    finally { setBusy(false); }
  };

  const ui = target && (
    <QuoteAcceptDialog quote={target} options={siblingsOf(target, all)} busy={busy} onClose={() => setTarget(null)} onConfirm={confirm} />
  );

  return {
    accept,
    setStatus: (q: Quotation, status: string) => (status === 'accepted' ? accept(q) : lifecycle.setStatus(q, status)),
    share: lifecycle.share,
    ui,
  };
};
