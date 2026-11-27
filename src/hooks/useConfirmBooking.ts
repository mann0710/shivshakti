import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Payment } from '../types';

export interface AdvanceRow { id: string; amount: number; payment_type: Payment['payment_type']; payment_mode: Payment['payment_mode']; notes?: string; payment_date?: string }

interface ConfirmArgs {
  bookingId: string;
  quoteId?: string;
  patch?: object;            // acceptPatch: picks, final guests and the locked price
  siblings?: string[];       // other options, marked not chosen
  guests?: number;
  payment?: AdvanceRow | null;
  anyStatus?: boolean;       // the no-quote Confirm may move any status to confirmed
}

// A random id made before saving, so a retried confirm finds its payment instead of adding another.
export const newId = (): string => (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.floor(Math.random() * 16); return (c === 'x' ? r : (r % 4) + 8).toString(16); }));

// Before the revisions/confirm database update the function is missing; callers then save step by step.
export const missingFunction = (e: unknown) => {
  const x = e as { code?: string; message?: string } | null;
  return x?.code === 'PGRST202' || x?.code === '42883' || /confirm_booking/i.test(x?.message ?? '');
};

// Confirm booking in one database step; returns 'confirmed' when the booking's status moved.
export const useConfirmBooking = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: ConfirmArgs): Promise<string | null> => {
      const { data, error } = await supabase.rpc('confirm_booking', {
        p_booking: a.bookingId, p_quote: a.quoteId ?? null, p_patch: a.patch ?? {}, p_siblings: a.siblings ?? [],
        p_guests: a.guests ?? null, p_payment: a.payment ?? null, p_any_status: !!a.anyStatus,
      });
      if (error) throw error;
      return (data as string | null) ?? null;
    },
    onSuccess: () => ['quotations', 'bookings', 'all_payments', 'payments', 'invoices'].forEach(k => qc.invalidateQueries({ queryKey: [k] })),
  });
};
