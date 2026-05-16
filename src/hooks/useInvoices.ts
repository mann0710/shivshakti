import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Invoice, Payment } from '../types';
import { todayIST } from '../lib/ist';

// Recalculate invoice totals from all payments + mark booking completed if fully paid
const recalculateInvoice = async (invoiceId: string) => {
  const { data: payments } = await supabase
    .from('payments').select('amount').eq('invoice_id', invoiceId);
  const totalPaid = (payments || []).reduce((s: number, p: any) => s + p.amount, 0);

  const { data: inv } = await supabase
    .from('invoices').select('total_amount, booking_id').eq('id', invoiceId).single();
  if (!inv) return;

  const newBalance = Math.max(0, inv.total_amount - totalPaid);
  const newStatus = newBalance <= 0 ? 'paid' : totalPaid > 0 ? 'sent' : 'draft';
  await supabase.from('invoices')
    .update({ advance_paid: totalPaid, balance_due: newBalance, status: newStatus })
    .eq('id', invoiceId);

  if (newBalance <= 0 && inv.booking_id) {
    await supabase.from('bookings').update({ status: 'completed' }).eq('id', inv.booking_id);
  }
};

export const useInvoices = () =>
  useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, booking:bookings(*, customer:customers(*), menu:menus(*))')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Invoice[];
    },
  });

export const useCreateInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (invoice: Partial<Invoice>) => {
      const { count } = await supabase
        .from('invoices').select('*', { count: 'exact', head: true });
      const invoiceNumber = `INV-${String((count || 0) + 1).padStart(4, '0')}`;

      const subtotal = invoice.subtotal || 0;
      const discount_amount = invoice.discount_amount || 0;
      const discount_type = invoice.discount_type || 'amount';
      const discountedSubtotal = Math.max(0, subtotal - discount_amount);
      const gst_rate = 18;
      const gst_amount = Math.round((discountedSubtotal * gst_rate) / 100);
      const total_amount = discountedSubtotal + gst_amount;
      const balance_due = Math.max(0, total_amount - (invoice.advance_paid || 0));

      const { data, error } = await supabase
        .from('invoices')
        .insert({
          ...invoice,
          invoice_number: invoiceNumber,
          discount_amount,
          discount_type,
          gst_rate,
          gst_amount,
          total_amount,
          balance_due,
          issue_date: invoice.issue_date || todayIST(),
        })
        .select('*, booking:bookings(*, customer:customers(*), menu:menus(*))')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  });
};

export const useRecordPayment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      invoiceId, amount, payment_type, payment_mode, notes, payment_date,
    }: {
      invoiceId: string; amount: number; payment_type: 'advance' | 'partial';
      payment_mode: string; notes?: string; payment_date?: string;
    }) => {
      const { error: payErr } = await supabase.from('payments').insert({
        invoice_id: invoiceId, amount, payment_type, payment_mode, notes,
        payment_date: payment_date || todayIST(),
      });
      if (payErr) throw payErr;
      await recalculateInvoice(invoiceId);
    },
    onSuccess: (_, { invoiceId }) => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['payments', invoiceId] });
      qc.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
};

export const useUpdatePayment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id, invoiceId, amount, payment_type, payment_mode, notes, payment_date,
    }: {
      id: string; invoiceId: string; amount: number; payment_type: 'advance' | 'partial';
      payment_mode: string; notes?: string; payment_date: string;
    }) => {
      const { error } = await supabase.from('payments')
        .update({ amount, payment_type, payment_mode, notes, payment_date })
        .eq('id', id);
      if (error) throw error;
      await recalculateInvoice(invoiceId);
    },
    onSuccess: (_, { invoiceId }) => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['payments', invoiceId] });
      qc.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
};

export const useDeletePayment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, invoiceId }: { id: string; invoiceId: string }) => {
      const { error } = await supabase.from('payments').delete().eq('id', id);
      if (error) throw error;
      await recalculateInvoice(invoiceId);
    },
    onSuccess: (_, { invoiceId }) => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['payments', invoiceId] });
      qc.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
};

export const usePaymentHistory = (invoiceId: string | undefined) =>
  useQuery({
    queryKey: ['payments', invoiceId],
    enabled: !!invoiceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments').select('*')
        .eq('invoice_id', invoiceId!)
        .order('payment_date', { ascending: false });
      if (error) throw error;
      return data as Payment[];
    },
  });

// Unified recalculation — handles both discount changes and GST toggle
export const useRecalculateTotals = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ invoiceId, discount_amount, discount_type, apply_gst }: {
      invoiceId: string;
      discount_amount: number;
      discount_type: 'amount' | 'percentage';
      apply_gst: boolean;
    }) => {
      const { data: inv } = await supabase
        .from('invoices').select('subtotal, advance_paid').eq('id', invoiceId).single();
      if (!inv) throw new Error('Invoice not found');
      const discAmt = discount_type === 'percentage'
        ? Math.round((inv.subtotal * discount_amount) / 100)
        : discount_amount;
      const discountedSubtotal = Math.max(0, inv.subtotal - discAmt);
      const gst_rate = apply_gst ? 18 : 0;
      const gst_amount = apply_gst ? Math.round((discountedSubtotal * 18) / 100) : 0;
      const total_amount = discountedSubtotal + gst_amount;
      const advance_paid = inv.advance_paid || 0;
      const balance_due = Math.max(0, total_amount - advance_paid);
      const status = balance_due <= 0 ? 'paid' : advance_paid > 0 ? 'sent' : 'draft';
      const { error } = await supabase.from('invoices').update({
        discount_amount: discAmt, discount_type,
        gst_rate, gst_amount, total_amount, balance_due, status,
      }).eq('id', invoiceId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  });
};

export const useAllPayments = () =>
  useQuery({
    queryKey: ['all_payments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments').select('id, amount, payment_type, created_at');
      if (error) throw error;
      return (data || []) as Pick<Payment, 'id' | 'amount' | 'payment_type' | 'created_at'>[];
    },
  });
