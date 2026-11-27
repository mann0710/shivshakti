import React from 'react';
import toast from 'react-hot-toast';
import { Quotation, useUpdateQuotationStatus } from './useQuotations';
import { useUpdateBooking } from './useBookings';
import { Navigate } from './useNavIntent';
import { Booking } from '../types';
import { promptCalendar, useTeamEmails } from '../components/catering/BookingCalendar';

const OPEN = new Set(['inquiry', 'followup', 'pending']);
// Inline so it looks the same on any screen (quotes.css loads only with Quotations).
const linkBtn: React.CSSProperties = { border: 'none', background: 'none', color: 'var(--primary)', font: 'inherit', fontWeight: 700, minHeight: 40, cursor: 'pointer' };

// Quote actions that also move the booking along, so the two statuses never need manual syncing.
export const useQuoteLifecycle = (onNavigate?: Navigate) => {
  const updateStatus = useUpdateQuotationStatus();
  const updateBooking = useUpdateBooking();
  const teamEmails = useTeamEmails();

  // The saved booking when its status changed, else null; `reopen` also brings a cancelled booking back to follow-up.
  const bookingTo = async (q: Quotation, status: 'followup' | 'confirmed', reopen = false): Promise<Booking | null> => {
    const b = q.booking;
    if (!b || !q.booking_id) return null;
    const moves = status === 'confirmed' ? OPEN.has(b.status) : b.status === 'inquiry' || (reopen && b.status === 'cancelled');
    if (!moves) return null;
    const saved: Booking | null = await updateBooking.mutateAsync({ id: q.booking_id, status });
    return saved ?? ({ ...b, status, customer: b.customer ?? q.customer } as Booking);
  };

  // "QTN-0023 accepted · Kavit's booking confirmed  [Add to Google Calendar] [Create invoice]"; the booking part only when it moved.
  const acceptedToast = (q: Quotation, confirmed: Booking | null) => {
    const who = String(q.customer?.name || '').trim().split(/\s+/)[0];
    const text = `${q.quotation_number} accepted${confirmed && who ? ` · ${who}'s booking confirmed` : ''}`;
    const invoice = onNavigate && q.booking_id
      ? (close: () => void) => <button type="button" style={linkBtn} onClick={() => { close(); onNavigate('billing', { action: 'new', id: q.booking_id }); }}>Create invoice</button>
      : undefined;
    if (confirmed) { promptCalendar(confirmed, teamEmails, text, invoice); return; }
    if (!invoice) { toast.success(text); return; }
    toast(t => <span className="q-toast">{text}{invoice(() => toast.dismiss(t.id))}</span>, { duration: 8000 });
  };

  // Accepted confirms the booking; Sent moves an inquiry to follow-up; reopening a declined quote revives its booking.
  const setStatus = async (list: Quotation[], status: string) => {
    const q = list[0];
    if (!q) return;
    const nums = list.map(o => o.quotation_number).join(', ');
    const reopen = status === 'sent' && q.status === 'rejected';
    try {
      for (const o of list) await updateStatus.mutateAsync({ id: o.id, status });
      if (status === 'accepted') acceptedToast(q, await bookingTo(q, 'confirmed'));
      else {
        if (status === 'sent') await bookingTo(q, 'followup', reopen);
        toast.success(status === 'rejected' ? `${nums} marked lost` : status === 'sent' ? `${nums} ${reopen ? 'reopened' : 'marked sent'}` : 'Status updated');
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

  return { setStatus, markSent, announce: acceptedToast };
};
