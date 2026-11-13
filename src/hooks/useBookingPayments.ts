import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { fetchAll } from '../lib/fetchAll';
import { todayIST } from '../lib/ist';
import { Payment } from '../types';
import { ensureAdvanceRow, recalculateInvoice } from './useInvoices';

export const BOOKING_PAYMENTS_MIGRATION_FILE = 'supabase/migrations/20261114_booking_payments.sql';

// Payments carry their booking (Settings › Data lists the update until it has run).
export const useHasBookingPayments = () => useQuery({
  queryKey: ['schema_status', 'booking_payments'],
  staleTime: Infinity,
  queryFn: async () => !(await supabase.from('payments').select('booking_id').limit(1)).error,
}).data !== false;

// Every catering payment (before and after the invoice), with its booking, mode and date.
export const usePaymentRows = () => useQuery({
  queryKey: ['all_payments', 'rows'],
  queryFn: () => fetchAll<Payment>((from, to) => supabase.from('payments').select('*').order('payment_date').range(from, to)),
});

export interface PaymentInput {
  id?: string;               // set: change this payment
  bookingId: string;
  invoiceId?: string | null; // the booking's invoice, once it has one
  amount: number;            // negative: money given back
  payment_type: Payment['payment_type'];
  payment_mode: Payment['payment_mode'];
  notes?: string;
  payment_date?: string;
}

const useRefresh = () => {
  const qc = useQueryClient();
  return () => ['all_payments', 'payments', 'invoices', 'bookings'].forEach(k => qc.invalidateQueries({ queryKey: [k] }));
};

// Adds or changes a payment on a booking; an invoiced booking's totals follow.
export const useSavePayment = () => {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (p: PaymentInput) => {
      const row = {
        booking_id: p.bookingId, invoice_id: p.invoiceId ?? null, amount: p.amount, payment_type: p.payment_type,
        payment_mode: p.payment_mode, notes: p.notes?.trim() || null, payment_date: p.payment_date || todayIST(),
      };
      if (p.invoiceId && !p.id) await ensureAdvanceRow(p.invoiceId);
      const { error } = p.id ? await supabase.from('payments').update(row).eq('id', p.id) : await supabase.from('payments').insert(row);
      if (error) throw error;
      if (p.invoiceId) await recalculateInvoice(p.invoiceId);
    },
    onSuccess: refresh,
  });
};

export const useRemovePayment = () => {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async ({ id, invoiceId }: { id: string; invoiceId?: string | null }) => {
      const { error } = await supabase.from('payments').delete().eq('id', id);
      if (error) throw error;
      if (invoiceId) await recalculateInvoice(invoiceId);
    },
    onSuccess: refresh,
  });
};
