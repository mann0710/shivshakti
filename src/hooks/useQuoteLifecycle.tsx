import React from 'react';
import toast from 'react-hot-toast';
import { Quotation, useUpdateQuotationStatus } from './useQuotations';
import { useUpdateBooking } from './useBookings';
import { Navigate } from './useNavIntent';

const OPEN = new Set(['inquiry', 'followup', 'pending']);

// Quote actions that also move the booking along, so the two statuses never need manual syncing.
export const useQuoteLifecycle = (onNavigate?: Navigate) => {
  const updateStatus = useUpdateQuotationStatus();
  const updateBooking = useUpdateBooking();

  const bookingTo = async (q: Quotation, status: 'followup' | 'confirmed') => {
    const b = q.booking;
    if (!b || !q.booking_id) return;
    if (status === 'followup' ? b.status !== 'inquiry' : !OPEN.has(b.status)) return;
    await updateBooking.mutateAsync({ id: q.booking_id, status });
  };

  // "QTN-0023 accepted · Kavit's booking confirmed  [Create invoice]"
  const acceptedToast = (q: Quotation) => {
    const who = String(q.customer?.name || '').trim().split(/\s+/)[0];
    const text = `${q.quotation_number} accepted${who ? ` · ${who}'s booking confirmed` : ''}`;
    if (!onNavigate || !q.booking_id) { toast.success(text); return; }
    toast(t => (
      <span className="q-toast">
        {text}
        <button type="button" onClick={() => { toast.dismiss(t.id); onNavigate('billing', { action: 'new', id: q.booking_id }); }}>Create invoice</button>
      </span>
    ), { duration: 8000 });
  };

  // Accepted confirms the booking; Sent moves an inquiry to follow-up.
  const setStatus = async (q: Quotation, status: string) => {
    try {
      await updateStatus.mutateAsync({ id: q.id, status });
      if (status === 'accepted') {
        await bookingTo(q, 'confirmed');
        acceptedToast(q);
      } else {
        if (status === 'sent') await bookingTo(q, 'followup');
        toast.success(status === 'rejected' ? `${q.quotation_number} marked lost` : status === 'sent' ? `${q.quotation_number} marked sent` : 'Status updated');
      }
    } catch (e: any) { toast.error(e?.message || 'Failed to update'); }
  };

  // Every draft that went out is now sent; the booking moves to follow-up.
  const markSent = async (list: Quotation[]) => {
    const drafts = list.filter(o => o.status === 'draft');
    if (!drafts.length) return;
    try {
      for (const o of drafts) await updateStatus.mutateAsync({ id: o.id, status: 'sent' });
      await bookingTo(list[0], 'followup');
    } catch { /* sending already succeeded */ }
  };

  return { setStatus, markSent };
};
