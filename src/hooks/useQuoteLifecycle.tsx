import React from 'react';
import toast from 'react-hot-toast';
import { Quotation, useUpdateQuotationStatus } from './useQuotations';
import { useUpdateBooking } from './useBookings';
import { Navigate } from './useNavIntent';
import { shareQuotation } from '../lib/quotationShare';

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

  const invoiceToast = (bookingId: string) => {
    if (!onNavigate) { toast.success('Booking confirmed'); return; }
    toast(t => (
      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        Booking confirmed.
        <button onClick={() => { toast.dismiss(t.id); onNavigate('billing', { action: 'new', id: bookingId }); }}
          style={{ background: '#E8750A', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 12 }}>
          Create invoice →
        </button>
      </span>
    ), { duration: 15000 });
  };

  // Accepted confirms the booking; Sent moves an inquiry to follow-up.
  const setStatus = async (q: Quotation, status: string) => {
    try {
      await updateStatus.mutateAsync({ id: q.id, status });
      if (status === 'accepted') {
        await bookingTo(q, 'confirmed');
        if (q.booking_id) invoiceToast(q.booking_id);
      } else {
        if (status === 'sent') await bookingTo(q, 'followup');
        toast.success('Status updated');
      }
    } catch (e: any) { toast.error(e?.message || 'Failed to update'); }
  };

  // Sharing a draft marks it Sent.
  const share = async (q: Quotation, withPrices = true, options?: Quotation[]) => {
    const res = await shareQuotation(q, withPrices, options);
    // Every draft in the PDF is now sent.
    const drafts = (options?.length ? options : [q]).filter(o => o.status === 'draft');
    if ((res === 'shared' || res === 'whatsapp') && drafts.length) {
      try {
        for (const o of drafts) await updateStatus.mutateAsync({ id: o.id, status: 'sent' });
        await bookingTo(q, 'followup');
      } catch { /* sharing already succeeded */ }
    }
  };

  return { setStatus, share };
};
